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

  const parsed = yaml.load(fs.readFileSync(LOCAL_YML, 'utf8'));
  const landscape = Array.isArray(parsed?.landscape) ? parsed.landscape : [];

  const projects = [];
  for (const catWrapper of landscape) {
    const category = catWrapper?.category && typeof catWrapper.category === 'object'
      ? catWrapper.category
      : catWrapper;
    if (!category?.name || !Array.isArray(category.subcategories)) continue;

    for (const subWrapper of category.subcategories) {
      const subcategory = subWrapper?.subcategory && typeof subWrapper.subcategory === 'object'
        ? subWrapper.subcategory
        : subWrapper;
      if (!subcategory?.name || !Array.isArray(subcategory.items)) continue;

      for (const itemWrapper of subcategory.items) {
        const item = itemWrapper?.item && typeof itemWrapper.item === 'object'
          ? itemWrapper.item
          : itemWrapper;
        if (!item?.name) continue;

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

  _cache = projects;
  return projects;
}

router.get('/', (req, res) => {
  try {
    res.json(loadLandscape());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.fetchLandscape = loadLandscape;
