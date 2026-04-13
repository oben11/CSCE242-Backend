const express = require("express");
const cors = require("cors");
const multer = require("multer");
const app = express();
const Joi = require("joi");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = "./public/images/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Front end will be in public folder
app.use(express.static("public"));
// This allows us to parse json in the body of requests
app.use(express.json());
app.use(cors());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/images/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

const locations = require("./json/locations.json");
const merchandise = require("./json/merchandise.json");

// Serve all locations
app.get("/api/locations", (req, res) => {
  console.log("GET request received for /api/locations");
  res.send(locations);
});

// Serve a single location
app.get("/api/locations/:id", (req, res) => {
  console.log("GET request received for /api/locations/:id");
  const id = parseInt(req.params.id);
  const location = locations.find((l) => l.id === id);
  if (!location) {
    res.status(404).send("Location not found");
  } else {
    res.send(location);
  }
});

// Serve location images
app.get("/api/locations/:id/image", (req, res) => {
  const id = parseInt(req.params.id);
  const location = locations.find((l) => l.id === id);

  if (!location) {
    return res.status(404).send("Location not found");
  }

  const imagePath = path.join(__dirname, "public", location.img);
  res.sendFile(imagePath);
});

// Add a new location
app.post("/api/locations", upload.single("image"), (req, res) => {
  console.log("POST request received for /api/locations");

  if (!req.file) {
    return res.status(400).send("Image file is required");
  }

  const result = validateLocation(req.body);
  if (result.error) {
    return res.status(400).send(result.error.details[0].message);
  }

  console.log("Passed validation");

  const location = {
    id: locations.length + 1,
    img: `/images/${req.file.originalname}`,
    alt: req.body.alt,
    name: req.body.name,
    address: req.body.address,
    hours: req.body.hours,
    phone: req.body.phone,
  };

  locations.push(location);
  res.send(location);
});

const validateLocation = (location) => {
  const schema = Joi.object({
    id: Joi.allow(""),
    alt: Joi.string().min(3).required(),
    name: Joi.string().min(3).required(),
    address: Joi.string().min(3).required(),
    hours: Joi.string().min(3).required(),
    phone: Joi.string().min(7).required(),
  });
  return schema.validate(location);
};

// Serve all merchandise
app.get("/api/merchandise", (req, res) => {
  console.log("GET request received for /api/merchandise");
  res.send(merchandise);
});

// Serve a single merchandise item
app.get("/api/merchandise/:id", (req, res) => {
  console.log("GET request received for /api/merchandise/:id");
  const id = parseInt(req.params.id);
  const merch = merchandise.find((m) => m.id === id);
  if (!merch) {
    res.status(404).send("Merchandise item not found");
  } else {
    res.send(merch);
  }
});

const port = process.env.PORT || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is up and running on ${port}`);
});
