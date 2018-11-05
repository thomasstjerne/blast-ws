module.exports = {
    apps: [
        {
          name: 'blast-ws',
          script: './app.js',
          watch: true,
          env: {
              'PORT': 9000,
              'NODE_ENV': 'local'
          },
          env_production: {
              'PORT': 80,
              'NODE_ENV': 'production'
          }
        }
    ]
  };
