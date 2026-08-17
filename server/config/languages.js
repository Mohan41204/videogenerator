const SUPPORTED_LANGUAGES = {
  en: {
    name: "English",
    code: "en",       // gtts uses 'en' (and then en-in for accent in our audio.service.js)
    fileName: "english.mp3"
  },
  ta: {
    name: "Tamil",
    code: "ta",
    fileName: "tamil.mp3"
  },
  hi: {
    name: "Hindi",
    code: "hi",
    fileName: "hindi.mp3"
  },
  ml: {
    name: "Malayalam",
    code: "ml",
    fileName: "malayalam.mp3"
  },
  te: {
    name: "Telugu",
    code: "te",
    fileName: "telugu.mp3"
  },
  kn: {
    name: "Kannada",
    code: "kn",
    fileName: "kannada.mp3"
  }
};

module.exports = SUPPORTED_LANGUAGES;
