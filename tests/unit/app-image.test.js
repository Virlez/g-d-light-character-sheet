const assert = require('node:assert/strict');
const test = require('node:test');
const { createBrowserContext, loadBrowserScript } = require('./load-browser-script');

function makeClassList() {
  const values = new Set();
  return {
    values,
    add: (value) => values.add(value),
    remove: (value) => values.delete(value),
    contains: (value) => values.has(value)
  };
}

function loadImageModule() {
  const context = createBrowserContext();
  return loadBrowserScript(context, 'js/app-image.js').CharacterSheetImage;
}

test('applyImageData accepts and normalizes safe image data URLs', () => {
  const image = loadImageModule();
  const containerClassList = makeClassList();
  const previewClassList = makeClassList();
  previewClassList.add('hidden');
  const container = { classList: containerClassList };
  const imgInput = { closest: () => container };
  const imgPreview = { style: {}, classList: previewClassList };
  let moveUiEnsured = false;

  const result = image.applyImageData({
    imgInput,
    imgPreview,
    imageData: ' data:image/png;base64,QUJD\nRA== ',
    ensureMoveUI: () => { moveUiEnsured = true; }
  });

  assert.equal(result, 'data:image/png;base64,QUJDRA==');
  assert.equal(imgPreview.style.backgroundImage, 'url(data:image/png;base64,QUJDRA==)');
  assert.equal(imgPreview.style.backgroundSize, 'cover');
  assert.equal(imgPreview.style.backgroundPosition, '50% 20%');
  assert.equal(previewClassList.contains('hidden'), false);
  assert.equal(containerClassList.contains('has-image'), true);
  assert.equal(moveUiEnsured, true);
});

test('applyImageData rejects non-image and malformed data URLs without mutating UI', () => {
  const image = loadImageModule();
  const containerClassList = makeClassList();
  const previewClassList = makeClassList();
  const imgInput = { closest: () => ({ classList: containerClassList }) };
  const imgPreview = { style: {}, classList: previewClassList };

  assert.equal(image.applyImageData({
    imgInput,
    imgPreview,
    imageData: 'data:text/html;base64,PHNjcmlwdD4=',
    ensureMoveUI: () => { throw new Error('should not be called'); }
  }), null);

  assert.equal(image.applyImageData({
    imgInput,
    imgPreview,
    imageData: 'data:image/png;base64,not valid !!!',
    ensureMoveUI: () => { throw new Error('should not be called'); }
  }), null);

  assert.deepEqual(imgPreview.style, {});
  assert.equal(containerClassList.contains('has-image'), false);
});
