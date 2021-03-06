<?php
/**
 * @file
 * Convert a field to UTF-8 format.
 */

$plugin = array(
  'form' => 'os_importer_utf_8_form',
  'callback' => 'os_importer_utf_8_convert',
  'name' => t('Convert to UTF-8'),
  'category' => 'Text',
);

/**
 * Tamper form.
 */
function os_importer_utf_8_form($importer, $element_key, $settings) {
  $form = array();
  $form['help'] = array(
    '#markup' => t('Convert the value of the field to UTF-8 format.'),
  );
  return $form;
}

/**
 * Tamper callback.
 */
function os_importer_utf_8_convert($result, $item_key, $element_key, &$field, $settings, $source) {
  if (is_array($field)) {
    foreach ($field as $key => $value) {
      $field[$key] = iconv($source->config['FeedsFileFetcher']['encode'], "UTF-8", $value);
    }
  }
  else {
    $field = iconv($source->config['FeedsFileFetcher']['encode'], "UTF-8", $field);
  }
}
