  module.exports = {
    apps: [{
      name: "arazit-crm",
      script: "./server.js",
      env: {
        NODE_ENV: "production",
        PORT: 5000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      node_args: '--experimental-specifier-resolution=node'
    }]
  }; 
