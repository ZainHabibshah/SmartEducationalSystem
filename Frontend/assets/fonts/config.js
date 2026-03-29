const fonts = {
  'Outfit-Regular': require('./Outfit-Regular.ttf'),
  'grifterbold': require('./grifterbold.otf')
};

export const fontAssets = Object.keys(fonts).map((key) => fonts[key]);

export const FONT_FAMILIES = {
  REGULAR: 'Outfit-Regular',
  BOLD: 'grifterbold' // Fallback to regular for bold
};

module.exports = {
  assets: ['./assets/fonts']
};
  