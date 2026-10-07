/**
 * moment ships its locale files as plain JS with no type declarations, which
 * `moduleResolution: "Bundler"` rejects for side-effect imports.
 */
declare module 'moment/locale/*';
