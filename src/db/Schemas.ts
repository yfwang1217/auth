import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
	email: String,
	password: String,
	is_active: Boolean,
	is_banned: Boolean,
	create_time: Date,
	user_id: String,
});

const userSessionSchema = new mongoose.Schema({
	token: String,
	user_id: String,
	auth_code: Number,
	is_active: Boolean,
	create_time: Date,
	update_time: Date,
});

const schemas = {
	users: userSchema,
	user_sessions: userSessionSchema,
};

export { schemas };
