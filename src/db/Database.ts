import mongoose, { Schema, Model, Document } from 'mongoose';

// Define Mongoose schema
const UserSchema = new Schema({
  email: String,
  // Add other fields as needed
});

// Define Mongoose model
interface IUser extends Document {
  email: string;
  // Add other fields as needed
}
const UserModel: Model<IUser> = mongoose.model<IUser>('User', UserSchema); // Use IUser here

// Connect to MongoDB
mongoose.connect('mongodb+srv://wyf1217:1217@atlascluster.bxfbul3.mongodb.net/', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
} as any);

// Define and pre-initialize the table methods
const tables = {
  users: {
    findOne: async (query: any) => {
      return await UserModel.findOne(query);
    },
    findOneAndUpdate: async (query: any, update: any) => {
      return await UserModel.findOneAndUpdate(query, update, { new: true });
    },
    create: async (doc: any) => {
      return await UserModel.create(doc);
    },
  },
  // Add other tables as needed
};

// Export database methods
export default class Database {
  static table(tableName: string) {
    const table = tables[tableName];
    if (table) {
      return table;
    } else {
      throw new Error(`Table ${tableName} not found`);
    }
  }
}
