module.exports = ({ config }) => {
  // If we are running in EAS Build and the secret is provided, use the EAS secure file path.
  // Otherwise, it falls back to the default local path in app.json.
  if (process.env.GOOGLE_SERVICES_JSON) {
    config.android = config.android || {};
    config.android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  }
  
  return config;
};
