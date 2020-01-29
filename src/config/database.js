module.exports = {
  dialect: 'postgres',
  host: '192.168.99.101',
  username: 'postgres',
  password: 'docker',
  database: 'gobarber',
  define: {
    timestamps: true,
    underscored: true,
    underscoredAll: true
  },
};

// Add pg and pg-hstore dependecies before doing it