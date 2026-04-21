require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Joi = require("joi");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const app = express();

/**
 * @author Oliver Benjamin
 * @description Main server file for locations and merchandise API
 */


/**
 * Paths & Express
 */
const publicDir = path.join(__dirname, "public");
const imagesDir = path.join(publicDir, "images");
const locationImagesDir = path.join(imagesDir, "location");
const merchandiseImagesDir = path.join(imagesDir, "merchandise");

const locationsFilePath = path.join(__dirname, "json", "locations.json");
const merchandiseFilePath = path.join(__dirname, "json", "merchandise.json");

app.use(express.static(publicDir));
app.use(express.json());
app.use(cors());

/**
 * Multer storage config
 */
const locationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, locationImagesDir);
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  },
});

const merchandiseStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, merchandiseImagesDir);
  },
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`;
    cb(null, safeName);
  },
});

const uploadLocation = multer({ storage: locationStorage });
const uploadMerchandise = multer({ storage: merchandiseStorage });

/**
 * Load json data
 */
let locations = require("./json/locations.json");
let merchandise = require("./json/merchandise.json");

/**
 * Save Locations
 */
const saveLocations = () => {
  fs.writeFileSync(locationsFilePath, JSON.stringify(locations, null, 2));
};

/**
 * Save Merchandise
 */
const saveMerchandise = () => {
  fs.writeFileSync(merchandiseFilePath, JSON.stringify(merchandise, null, 2));
};


/**
 * Ensures unique ID in
 * number order
 * 
 */
const getNextId = (items) => {
  if (!items.length) return 1;
  return Math.max(...items.map((item) => item.id)) + 1;
};


/**
 * Removes image file to clear up space
 * 
 */
const deleteFileIfExists = (relativeFilePath) => {
  if (!relativeFilePath) return;

  const cleanedPath = relativeFilePath.replace(/^\/+/, "");
  const fullPath = path.join(
    __dirname,
    "public",
    cleanedPath.replace(/^images\//, "images/"),
  );

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};

/**
 * Validation schemas for locations and merchandise using Joi
 */
const validateLocation = (location) => {
  const schema = Joi.object({
    id: Joi.any().optional(),
    alt: Joi.string().min(3).required(),
    name: Joi.string().min(3).required(),
    address: Joi.string().min(3).required(),
    hours: Joi.string().min(3).required(),
    phone: Joi.string().min(7).required(),
  });

  return schema.validate(location);
};

const validateMerchandise = (item) => {
  const schema = Joi.object({
    id: Joi.any().optional(),
    name: Joi.string().min(2).required(),
    category: Joi.string().min(2).required(),
    description: Joi.string().min(3).required(),
    alt: Joi.string().min(3).required(),
    colors: Joi.alternatives()
      .try(Joi.array().items(Joi.string().min(1)), Joi.string().allow(""))
      .required(),
    sizes: Joi.alternatives()
      .try(Joi.array().items(Joi.string().min(1)), Joi.string().allow(""))
      .required(),
    price: Joi.number().positive().required(),
  });

  return schema.validate(item);
};


const normalizeArrayField = (value) => {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    if (value.trim() === "") return [];

    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  return [];
};

// -----------------------------
// Mongo connection
// -----------------------------
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((error) => {
      console.log("Couldn't connect to MongoDB", error);
    });
} else {
  console.log("MONGODB_URI not set. Skipping MongoDB connection.");
}

// -----------------------------
// Location routes
// -----------------------------

// Get all locations
app.get("/api/locations", (req, res) => {
  console.log("GET /api/locations");
  res.send(locations);
});

// Get one location
app.get("/api/locations/:id", (req, res) => {
  console.log("GET /api/locations/:id");

  const id = parseInt(req.params.id);
  const location = locations.find((l) => l.id === id);

  if (!location) {
    return res.status(404).send("Location not found");
  }

  res.send(location);
});

// Get location image file
app.get("/api/locations/:id/image", (req, res) => {
  const id = parseInt(req.params.id);
  const location = locations.find((l) => l.id === id);

  if (!location) {
    return res.status(404).send("Location not found");
  }

  const relativeImgPath = location.img.replace(/^\/+/, "");
  const imagePath = path.join(__dirname, "public", relativeImgPath);

  if (!fs.existsSync(imagePath)) {
    return res.status(404).send("Image not found");
  }

  res.sendFile(imagePath);
});

// Create location
app.post("/api/locations", uploadLocation.single("image"), (req, res) => {
  console.log("POST /api/locations");

  if (!req.file) {
    return res.status(400).send("Image file is required");
  }

  const result = validateLocation(req.body);
  if (result.error) {
    return res.status(400).send(result.error.details[0].message);
  }

  const location = {
    id: getNextId(locations),
    img: `/images/location/${req.file.filename}`,
    alt: req.body.alt,
    name: req.body.name,
    address: req.body.address,
    hours: req.body.hours,
    phone: req.body.phone,
  };

  locations.push(location);
  saveLocations();

  res.status(201).send(location);
});

// Update location
app.put("/api/locations/:id", uploadLocation.single("image"), (req, res) => {
  console.log("PUT /api/locations/:id");

  const id = parseInt(req.params.id);
  const location = locations.find((l) => l.id === id);

  if (!location) {
    return res.status(404).send("Location not found");
  }

  const result = validateLocation(req.body);
  if (result.error) {
    return res.status(400).send(result.error.details[0].message);
  }

  location.alt = req.body.alt;
  location.name = req.body.name;
  location.address = req.body.address;
  location.hours = req.body.hours;
  location.phone = req.body.phone;

  if (req.file) {
    deleteFileIfExists(location.img);
    location.img = `/images/location/${req.file.filename}`;
  }

  saveLocations();
  res.send(location);
});

// Delete location
app.delete("/api/locations/:id", (req, res) => {
  console.log("DELETE /api/locations/:id");

  const id = parseInt(req.params.id);
  const locationIndex = locations.findIndex((l) => l.id === id);

  if (locationIndex === -1) {
    return res.status(404).send("Location not found");
  }

  const deletedLocation = locations.splice(locationIndex, 1)[0];
  deleteFileIfExists(deletedLocation.img);
  saveLocations();

  res.send(deletedLocation);
});

// -----------------------------
// Merchandise routes
// -----------------------------

// Get all merchandise
app.get("/api/merchandise", (req, res) => {
  console.log("GET /api/merchandise");
  res.send(merchandise);
});

// Get one merchandise item
app.get("/api/merchandise/:id", (req, res) => {
  console.log("GET /api/merchandise/:id");

  const id = parseInt(req.params.id);
  const merch = merchandise.find((m) => m.id === id);

  if (!merch) {
    return res.status(404).send("Merchandise item not found");
  }

  res.send(merch);
});

// Create merchandise
app.post("/api/merchandise", uploadMerchandise.single("image"), (req, res) => {
  console.log("POST /api/merchandise");

  if (!req.file) {
    return res.status(400).send("Image file is required");
  }

  const payload = {
    ...req.body,
    colors: normalizeArrayField(req.body.colors),
    sizes: normalizeArrayField(req.body.sizes),
    price: Number(req.body.price),
  };

  const result = validateMerchandise(payload);
  if (result.error) {
    return res.status(400).send(result.error.details[0].message);
  }

  const merchItem = {
    id: getNextId(merchandise),
    name: payload.name,
    category: payload.category,
    description: payload.description,
    image: {
      src: `/images/merchandise/${req.file.filename}`,
      alt: payload.alt,
    },
    colors: payload.colors,
    sizes: payload.sizes,
    price: payload.price,
  };

  merchandise.push(merchItem);
  saveMerchandise();

  res.status(201).send(merchItem);
});

// Update merchandise
app.put(
  "/api/merchandise/:id",
  uploadMerchandise.single("image"),
  (req, res) => {
    console.log("PUT /api/merchandise/:id");

    const id = parseInt(req.params.id);
    const merchItem = merchandise.find((m) => m.id === id);

    if (!merchItem) {
      return res.status(404).send("Merchandise item not found");
    }

    const payload = {
      ...req.body,
      colors: normalizeArrayField(req.body.colors),
      sizes: normalizeArrayField(req.body.sizes),
      price: Number(req.body.price),
    };

    const result = validateMerchandise(payload);
    if (result.error) {
      return res.status(400).send(result.error.details[0].message);
    }

    merchItem.name = payload.name;
    merchItem.category = payload.category;
    merchItem.description = payload.description;
    merchItem.image.alt = payload.alt;
    merchItem.colors = payload.colors;
    merchItem.sizes = payload.sizes;
    merchItem.price = payload.price;

    if (req.file) {
      deleteFileIfExists(merchItem.image.src);
      merchItem.image.src = `/images/merchandise/${req.file.filename}`;
    }

    saveMerchandise();
    res.send(merchItem);
  },
);

// Delete merchandise
app.delete("/api/merchandise/:id", (req, res) => {
  console.log("DELETE /api/merchandise/:id");

  const id = parseInt(req.params.id);
  const merchIndex = merchandise.findIndex((m) => m.id === id);

  if (merchIndex === -1) {
    return res.status(404).send("Merchandise item not found");
  }

  const deletedMerch = merchandise.splice(merchIndex, 1)[0];

  if (deletedMerch.image && deletedMerch.image.src) {
    deleteFileIfExists(deletedMerch.image.src);
  }

  saveMerchandise();
  res.send(deletedMerch);
});

const port = process.env.PORT || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is up and running on ${port}`);
});
