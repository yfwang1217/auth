import dotenv from "dotenv";
dotenv.config();

const config = {
  databaseUrl: process.env.DATABASE_URL || "mongodb+srv://wyf1217:1217@atlascluster.bxfbul3.mongodb.net/",
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  // Add other config variables as needed
};

export default config;
