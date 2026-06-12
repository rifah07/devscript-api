// This file forces TypeScript to include @types/multer globals
// Required because moduleResolution: nodenext doesn't auto-load them
//triple-slash directive is the correct way to force TypeScript to load global namespace augmentations
//when moduleResolution: nodenext won't do it automatically

/// <reference types="multer" />
