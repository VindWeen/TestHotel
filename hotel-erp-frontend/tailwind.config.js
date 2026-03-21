import formsPlugin from '@tailwindcss/forms';
import containerQueriesPlugin from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  corePlugins: {
    preflight: false, // Important to prevent conflicts with antd and generic resets already inside index.css
  },
  theme: {
    extend: {
      colors: {
        "primary": "#4f645b",
        "secondary-fixed": "#ffdad9",
        "on-primary-container": "#42564e",
        "on-tertiary-container": "#5f554d",
        "secondary-fixed-dim": "#fac8c8",
        "primary-fixed": "#d1e8dd",
        "on-secondary-fixed-variant": "#775252",
        "on-primary": "#e7fef3",
        "tertiary": "#675d55",
        "error-container": "#fa746f",
        "tertiary-fixed-dim": "#e8dacf",
        "on-error": "#fff7f6",
        "on-tertiary-fixed-variant": "#695f56",
        "on-tertiary-fixed": "#4c433b",
        "surface-container": "#efeee7",
        "outline-variant": "#b2b2ab",
        "inverse-primary": "#e7fff3",
        "surface-container-highest": "#e3e3db",
        "inverse-on-surface": "#9e9d99",
        "secondary-dim": "#6e494a",
        "on-background": "#31332e",
        "tertiary-container": "#f7e8dd",
        "on-secondary-container": "#6d4849",
        "on-primary-fixed": "#2f433c",
        "outline": "#7a7b75",
        "primary-fixed-dim": "#c3dacf",
        "on-tertiary": "#fff7f3",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#e9e8e1",
        "error-dim": "#67040d",
        "secondary-container": "#ffdad9",
        "on-surface-variant": "#5e6059",
        "on-secondary-fixed": "#583637",
        "surface-container-low": "#f5f4ed",
        "primary-dim": "#43574f",
        "tertiary-fixed": "#f7e8dd",
        "tertiary-dim": "#5b5149",
        "surface": "#fbf9f4",
        "surface-bright": "#fbf9f4",
        "primary-container": "#d1e8dd",
        "background": "#fbf9f4",
        "inverse-surface": "#0e0e0c",
        "on-secondary": "#fff7f6",
        "on-error-container": "#6e0a12",
        "surface-variant": "#e3e3db",
        "surface-tint": "#4f645b",
        "secondary": "#7b5556",
        "surface-dim": "#dadad2",
        "on-primary-fixed-variant": "#4b6057",
        "on-surface": "#31332e",
        "error": "#a83836"
      },
      fontFamily: {
        "headline": ["Manrope", "sans-serif"],
        "body": ["Manrope", "sans-serif"],
        "label": ["Manrope", "sans-serif"]
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "1.5rem",
        "full": "9999px"
      },
    },
  },
  plugins: [
    formsPlugin,
    containerQueriesPlugin,
  ],
}
