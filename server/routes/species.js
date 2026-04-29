const { Router } = require("express");
const { getSpeciesList, getSpeciesById, getSpeciesReports } = require("../lib/store");
const { sendError } = require("../lib/helpers");

const router = Router();

// GET /api/species
router.get("/", (_req, res) => {
  res.json({ items: getSpeciesList() });
});

// GET /api/species/:id
router.get("/:id", (req, res) => {
  const species = getSpeciesById(req.params.id);

  if (!species) {
    sendError(res, "Not Found", 404);
    return;
  }

  res.json({
    item: species,
    reports: getSpeciesReports(req.params.id),
  });
});

module.exports = router;
