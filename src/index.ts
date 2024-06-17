import fastify from "fastify";
import mongoose from "mongoose";
import config from "../config";
import Auth from "./Auth";

const app = fastify();

// Connect to MongoDB
mongoose.connect(config.databaseUrl, {
}).then(() => {
  console.log("Connected to database");
  // Initialize the Auth module
  Auth.init().then(() => {
    // Start the server
    app.listen(3000, () => {
      console.log("Server is running on port 3000");
    });
  });
}).catch((err) => {
  console.error("Error connecting to database:", err);
  process.exit(1);
});
