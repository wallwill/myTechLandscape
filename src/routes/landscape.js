'use strict';
const express = require('express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const LOCAL_YML = path.join(__dirname, '../../data/landscape.yml');

let _cache = null;

function loadLandscape() {
  if (_cache) return _cache;

  console.log('Parsing local landscape.yml...');
  const parsed = yaml.load(fs.readFileSync(LOCAL_YML, 'utf8'));

  const projects = [];
  for (const category of parsed.landscape || []) {
    for (const subcategory of category.subcategories || []) {
      for (const item of subcategory.items || []) {
        projects.push({
          id: item.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: item.name,
          category: category.name,
          subcategory: subcategory.name,
          homepage_url: item.homepage_url || null,
          logo: item.logo || null,
          description: item.description || null,
          project: item.project || null,
        });
      }
    }
  }

  console.log(`Loaded ${projects.length} projects from local file`);
  _cache = projects;
  return projects;
}

router.get('/', requireAuth, (req, res) => {
  try {
    res.json(loadLandscape());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.fetchLandscape = loadLandscape;
