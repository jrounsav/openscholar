(function ($) {
  var rootPath,
    open = angular.noop;

  angular.module('mediaBrowser', ['JSPager', 'EntityService', 'os-auth', 'ngSanitize', 'angularFileUpload', 'angularModalService', 'FileEditor', 'mediaBrowser.filters'])
    .config(function (){
       rootPath = Drupal.settings.paths.moduleRoot;
    })
    .run(['ModalService', function (ModalService) {
      open = function (params) {
        params = jQuery.extend(true, {}, defaultParams(), params);
        ModalService.showModal({
          templateUrl: rootPath+'/templates/browser.html',
          controller: 'BrowserCtrl',
          inputs: {
            params: params
          }
        }).then(function (modal) {
          modal.element.dialog(params.dialog);
          modal.close.then(function (result) {
            console.log(result);
            // run the function passed to us
            if (result) {
              console.log(result);
              params.onSelect(result);
            }
          });
        });
      }

      function defaultParams() {
        var params = {
          dialog: {
            buttons: {},
            dialogClass: 'media-wrapper',
            modal: true,
            draggable: false,
            resizable: false,
            minWidth: 600,
            width: 800,
            height: 650,
            position: 'center',
            title: undefined,
            overlay: {
              backgroundColor: '#000000',
              opacity: 0.4
            },
            zIndex: 10000,
            close: function (event, ui) {
              $(event.target).remove();
            }
          },
          browser: {
            panes: {
              web: true,
              upload: true,
              library: true
            },
            allowedTypes: {
              image: true,
              video: true,
              audio: true,
              executable: true,
              document: true
            }
          },
          onSelect: angular.noop
        };

        return params;
      }

      Drupal.media = Drupal.media || {};
      Drupal.media.popups = Drupal.media.popups || {};
      var oldPopup = Drupal.media.popups.mediaBrowser;
      Drupal.media.popups.mediaBrowser = function (onSelect, globalOptions, pluginOptions, widgetOptions) {
        var options = Drupal.media.popups.mediaBrowser.getDefaults();
        options.global = $.extend({}, options.global, globalOptions);
        options.plugins = pluginOptions;
        options.widget = $.extend({}, options.widget, widgetOptions);


        // Params to send along to the iframe.  WIP.
        var params = {};
        $.extend(params, options.global);
        params.plugins = options.plugins;
        params.onSelect = onSelect;

        open(params);
      }

      for (var k in oldPopup) {
        if (!Drupal.media.popups.mediaBrowser[k]) {
          Drupal.media.popups.mediaBrowser[k] = oldPopup[k];
        }
      }
    }])
  .controller('BrowserCtrl', ['$scope', '$filter', '$http', 'EntityService', '$sce', '$upload', '$timeout', 'params', 'close',
      function ($scope, $filter, $http, EntityService, $sce, $upload, $timeout, params, close) {

    // Initialization
    var service = new EntityService('files', 'id'),
      toEditForm = false;
    $scope.files = [];
    $scope.numFiles = 0;
    $scope.templatePath = rootPath;
    $scope.selection = 0;
    $scope.form = '';
    $scope.pane = 'upload';
    $scope.toBeUploaded = [];
    $scope.dupes = [];
    $scope.showButtons = false;
    $scope.params = params.browser;
    $scope.editing = false;
    $scope.deleting = false;

    $scope.extensions = [];
    if (params.file_extensions) {
      $scope.extensions = params.file_extensions.split(' ');
    }
    if (!params.override_extensions) {
      for (var t in params.types) {
        $scope.extensions = $scope.extensions.concat(Drupal.settings.extensionMap[t]);
      }
    }
    $scope.extensions.sort();

    if (params.max_filesize) {
      $scope.maxFilesize = params.max_filesize;
    }

    $scope.showHelp = false;

    if (close) {
      $scope.showButtons = true;
    }

    $scope.messages = {
      next: 0
    };

    // Watch for changes in file list
    $scope.$on('EntityService.files.add', function (event, file) {
      //$scope.files.push(file)
      $scope.pane = 'library';
      $scope.setSelection(file.id);
    });

    $scope.$on('EntityService.files.update', function (event, file) {
      $scope.files = service.getAll();
    });

    $scope.$on('EntityService.files.delete', function (event, id) {
      // Don't want to worry about what happens when you modify an array you're looping over
      var deleteMe;
      for (var i=0; i<$scope.files.length; i++) {
        if ($scope.files[i].id == id) {
          deleteMe = i;
          break;
        }
      }

      $scope.files.splice(deleteMe, 1);
    })


    service.fetch({})
      .then(function (result) {
        console.log(result);

        $scope.files = result.data.data;
        $scope.numFiles = $scope.files.length;
      });

    $scope.validate = function($file) {
      var file = $file;
      if (file && file instanceof File) {
        // TODO: Get validating properties from somewhere and check the file against them
        console.log(file);
        var size = params.max_filesize_raw > file.size,   // file is smaller than max
          ext = file.name.slice(file.name.lastIndexOf('.')+1),
          extension = $scope.extensions.indexOf(ext) !== -1,    // extension is found
          id;

        if (!size) {
          id = $scope.messages.next++;
          $scope.messages[id] = {
            text: file.name + ' is larger than the maximum filesize of ' + params.max_filesize,
          }
          $timeout(angular.bind($scope, removeMessage, id), 5000);
        }
        if (!extension) {
          id = $scope.messages.next++;
          $scope.messages[id] = {
            text: file.name + ' is not an accepted file type.',
          }
          $timeout(angular.bind($scope, removeMessage, id), 5000);
        }
        // if file is image and params specify max dimensions
        if (file.type.indexOf('image/') !== -1 && params.min_dimensions) {
          // since we can't force this function to wait, we have to use an onload
          // and check this before uploading
        }
        console.log($scope.messages);

        return size && extension;
      }
    }

    function removeMessage(id) {
      delete this.messages[id];
    }

    // looks for any files with a similar basename and extension to this file
    // if it finds any, it adds it to a list of dupes, then scans every file to find what the new name should be
    $scope.checkForDupes = function($files, $event, $rejected) {
      if ($files.length == 1) {
        toEditForm = true;
      }
      var toBeUploaded = [];
      $scope.dupes = [];
      for (var i=0; i<$files.length; i++) {
        var similar = [],
            basename = $files[i].name.replace(/\.[a-zA-Z0-9]*$/, ''),
            extension = $files[i].name.replace(basename, ''),
            dupeFound = false;

        for (var j=0; j<$scope.files.length; j++) {
          // find any file with a name that matches "basename{_dd}.ext" and add it to list of similar files
          if ($scope.files[j].filename.indexOf(basename) !== -1 && $scope.files[j].filename.indexOf(extension) !== -1) {
            similar.push($scope.files[j]);
            // also check if there is a file with the full filename and save this fact for later
            // this allows file.jpg to be uploaded when file_01.jpg already exists
            if ($scope.files[j].filename == $files[i].name) {
              dupeFound = true;
            }
          }
        }

        if (dupeFound) {
          // only one similar file found, drop _01 at the end
          if (similar.length == 1) {
            $files[i].newName = basename + '_01' + extension;
          }
          else {
            // lots of them found, look through all of them, find the highest number at the end, and add it
            // to the end of the original file name
            var max = 0;
            for (j=0; j<similar.length; j++) {
              var rem = similar[j].filename.replace(basename, '').replace(extension, '').replace('_', ''),
                num = rem ? parseInt(rem) : 0;

              if (num > max) {
                max = num;
              };
            }
            var num = max + 1;
            // convert num to a 2 digit string
            num = num < 10 ? '0'+num : num
            // and make the new file name
            $files[i].newName = basename+'_'+num+extension;
          }
          // with the new name complete, we can push this onto the list of dupes
          $scope.dupes.push($files[i]);
        }
        else {
          // not a dupe, just upload it silently
          toBeUploaded.push($files[i]);
        }
      }

      $scope.upload(toBeUploaded);
    }

    // renames the file before uploading
    $scope.rename = function ($index, $last) {
      $scope.dupes[$index].processed = true;

      if ($last) {
        finalizeDupes();
      }
    }

    // tells the server to replace the old file on disk with this new one
    // (just performs a swap on the hard drive)
    $scope.replace = function ($index, $last) {
      $scope.dupes[$index].processed = true;
      delete $scope.dupes[$index].newName;

      if ($last) {
        finalizeDupes();
      }
    }

    // cancels the upload process for this file
    $scope.cancelUpload = function ($index, $last) {
      $scope.dupes[$index].doNotUpload = true;
      $scope.dupes[$index].processed = true;

      if ($last) {
        finalizeDupes();
      }
    }

    function finalizeDupes() {
      var toBeUploaded = [];
      for (var i in $scope.dupes) {
        if (!$scope.dupes[i].doNotUpload) {
          toBeUploaded.push($scope.dupes[i]);
        }
      }

      $scope.upload(toBeUploaded);
      $scope.dupes = [];
    }

    (function () {
      var toBeUploaded = [],
        uploading = false,
        progress = null,
        currentlyUploading = 0;

      $scope.upload = function ($files) {
        for (var i=0; i<$files.length; i++) {
          toBeUploaded.push($files[i]);
        }

        if (!uploading && toBeUploaded.length) {
          uploading = true;
          $file = toBeUploaded[currentlyUploading];
          uploadOne($file);
        }
      }

      function uploadOne($file) {
        var fields = {};
        if (Drupal.settings.spaces) {
          fields.vsite = Drupal.settings.spaces.id;
        }
        $upload.upload({
          url: Drupal.settings.paths.api+'/files',
          file: $file,
          data: $file,                                        // UPLOADED FILES ARE NOT GETTING THE VSITE
          fileFormDataName: 'files[upload]',
          headers: {'Content-Type': $file.type},
          method: 'POST',
          fields: fields,
          fileName: $file.newName || null
        }).progress(function (e) {
          progress = e;
        }).success(function (e) {
          for (var i = 0; i< e.data.length; i++) {
            e.data[i].new = true;
            $scope.files.push(e.data[i]);
            service.register(e.data[i]);
          }

          currentlyUploading++;
          if (currentlyUploading < toBeUploaded.length) {
            $file = toBeUploaded[currentlyUploading];
            uploadOne($file);
          }
          else {
            toBeUploaded = [];
            uploading = false;
            progress = null;
            currentlyUploading = 0;
            $scope.pane = 'library';
            if (toEditForm) {
              $scope.setSelection(e.data[i].id);
              $scope.editing = true;
            }
          }
        });
      }

      $scope.uploadProgress = function () {
        return {
          uploading: uploading,
          filename: uploading ? toBeUploaded[currentlyUploading].name : '',
          progressBar: (uploading && progress) ? parseInt(100.0 * progress.loaded / progress.total) : 0,
          index: currentlyUploading+1,
          numFiles: toBeUploaded.length
        }
      }
    })();


    // selected file
    $scope.setSelection = function (fid) {
      $scope.selection = fid;
      $scope.selected_file = angular.copy(service.get(fid));
    };

    $scope.editMode = function (starting) {
      $scope.editting = starting;
      if (starting) {
        $scope.deleteMode(false);
      }
    }

    $scope.deleteMode = function (starting) {
      $scope.deleting = starting;
      if (starting) {
        $scope.editMode(false);
      }
    }

    // file edit form methods
    $scope.save = function() {
      service.edit($scope.selected_file);
    };

    $scope.deleteConfirmed = function() {
      service.delete($scope.selected_file)
        .then(function (resp) {
          $scope.deleting = false;
        });
    };


    $scope.embed = 'URL or Markup';
    $scope.embedSubmit = function () {
      // construct the entity
      var data = {
        embed: this.embed,
      }

      service.add(data);
    }

    $scope.insert = function () {
      var results = [];
      $scope.selected_file.fid = $scope.selected_file.id; // hack to prevent rewriting a lot of Media's code.
      results.push($scope.selected_file);

      close(results);
    }

    $scope.cancel = function () {
      close([]);
    }
  }])
  .directive('mbOpenModal', ['ModalService', function(ModalService) {

    function link(scope, elem, attr,contr) {
      elem.bind('click', clickHandler);
    }

    function clickHandler(event) {
      event.preventDefault();
      console.log(event);
      // get stuff from the element we clicked on and Drupal.settings
      open({});
    }

    return {
      template: '<ng-transclude></ng-transclude>',
      link: link,
      transclude: true
    }
  }]);
})(jQuery);