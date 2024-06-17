import Database from "./db/Database";
import { schemas } from "./db/Schemas";
import NetworkCore from "./networking/NetworkCore";
import WebUtil from "./networking/WebUtil";
import FmtTime from "./util/FmtTime";
import Global from "./util/Global";
import Logger from "./util/Logger";
import path from "path";
import { randomInt } from "crypto";
import Util from "./util/Util";
import * as uuid from "uuid";
import * as fs from "fs";
import Handlebars from "handlebars";
import AwsMgr from "./aws/AwsMgr";
import WebError from "./networking/WebError";

export default class Auth {
	static getTokenTTL(document: any) {
		const elapsed = FmtTime.getElapsedTime(
			FmtTime.fromTimeString(
				document["update_time"] ?? document["create_time"] ?? "",
			),
		);
		//Logger.info(`Elapsed time: ${elapsed.asSeconds()} seconds`);

		return elapsed.asSeconds();
	}

	static ensureGoodToken(entry?: any) {
		if (
			entry === null ||
			!entry["is_active"] ||
			this.getTokenTTL(entry) >
				Number(Global.envParam("token_ttl_seconds", "3600"))
		)
			throw new WebError("invalid_token", "auth", 403);
	}

	
	static async sendVerifyEmail(
		email: string,
		authCode: number,
	): Promise<void> {
		if (!email.endsWith(".edu")) {
			// Return early if the email is not a student email
			return;
		}
	
		const template = (
			await fs.promises.readFile(
				path.resolve(Global.workDir(), "hbs", "email_verify_zh.hbs"),
			)
		).toString();
	
		const delegate = Handlebars.compile(template);
		const msg = delegate({ authCode: authCode });
	
		//Send Email
		if (email !== "apple.demo@gmail.com") {
			const options = {
				fromName: "Bloom Team",
				htmlBody: msg,
				subject: "Your Verification Code for Bloom",
				toAddrs: [email],
			};
	
			AwsMgr.sendEmail(options);
		}
	}
	

	static async getUserWithToken(token?: string): Promise<any> {
		if (token === undefined)
			throw new WebError("invalid_token", "auth", 403);

		const tokenEntry: any = await Database.table("user_sessions")
			.findOne({
				token: token,
			})
			.lean();

		Logger.info(JSON.stringify(tokenEntry));

		this.ensureGoodToken(tokenEntry);

		const user: any = await Database.table("users")
			.findOne({
				user_id: tokenEntry["user_id"],
			})
			.lean();

		if (user === null) {
			throw new WebError("user_not_found", "auth", 403);
		} else if (user.is_banned === true) {
			throw new WebError("user_banned", "auth", 403);
		}

		return user;
	}

	static async getUserByEmail(email: string): Promise<any> {
		const user = await Database.table("users")
			.findOne({ email: email })
			.lean();

		if (user === null) throw new WebError("user_not_found", "auth", 403);

		return user ?? {};
	}

	static async createToken(params: any, customAuthCode?: number) {
		const authCode = customAuthCode ?? randomInt(100000, 1000000);

		let filteredDoc = Util.cloneObject(
			params,
			...Object.keys(schemas.user_sessions),
		);

		filteredDoc = {
			...filteredDoc,
			auth_code: authCode,
			token: uuid.v4(),
			update_time: new Date(FmtTime.now().toISOString()),
			create_time: new Date(FmtTime.now().toISOString()),
			is_active: false,
		};

		await Promise.all([
			Database.table("user_sessions").create(filteredDoc),
			this.sendVerifyEmail(params["email"], authCode),
		]);

		return filteredDoc;
	}

	static async addUser(data: any, user_id: string | undefined) {
		let filtered = Util.cloneObject(data, ...Object.keys(schemas.users));

		filtered = {
			...filtered,
			user_id: user_id === undefined ? uuid.v4() : user_id,
			create_time: new Date(FmtTime.now().toISOString()),
			is_active: false,
		};

		//@ts-ignore
		await Database.table("users").create(filtered);

		return filtered;
	}

	static async logout(token: string) {
		const entry = await Database.table("user_sessions")
			.findOne({ token: token })
			.lean();

		try {
			this.ensureGoodToken(entry);
		} catch (e) {
			//Shhh because I don't need the return value of this
		}

		Util.enqueueJob(async () => {
			await Database.table("user_sessions").findOneAndUpdate(
				{ token: token },
				{ $set: { is_active: false } },
			);
		}, "logout_queue");
	}

	static async login(params: any) {
		//Since emails are not case-sensitive, this prevents
		const email = (params["email"] as string).toLowerCase();

		//Look up the user by email in MongoDB
		let user: any = await Database.table("users")
			.findOne({ email: email })
			.lean();

		const user_id = user === null ? uuid.v4() : user["user_id"];

		//On-demand user creation
		if (user === null) {
			if (!email.endsWith(".edu")) throw new Error("user_email_invalid");

			user = await this.addUser(
				{
					...params,
					email: email,
				},
				user_id,
			);
		} else if ((user["is_banned"] ?? false) == true)
			throw new WebError("user_banned", "auth", 403);

		params["user_id"] = user_id;

		//Generate Token
		const token = await this.createToken(
			params,
			email === "apple.demo@gmail.com" ? 123456 : undefined,
		);

		return token;
	}

	static async renewToken(token: string) {
		//If the token is simply ill-formed, reject
		if (!uuid.validate(token))
			throw new WebError("invalid_token", "auth", 403);

		//Lookup the token entry in MongoDB
		const tokenEntry: any = await Database.table("user_sessions")
			.findOne({ token: token })
			.lean();

		this.ensureGoodToken(tokenEntry);

		//Look up user to see if he/she/them CAN renew token
		const user: any = await Database.table("users")
			.findOne({ user_id: tokenEntry.user_id })
			.lean();

		//If user cannot be found, banned, or not verified / marked as inactive by our staff, we reject
		if (user === null || user.is_banned || !user.is_active)
			throw new WebError("user_banned", "auth", 403);

		//Compute elasped time in seconds between last refresh time and now
		// const elapsed = FmtTime.getElapsedTime(
		// 	FmtTime.fromTimeString(entry[""] ?? ""),
		// );
		Logger.info(
			`This token's elapsed time: ${this.getTokenTTL(
				tokenEntry,
			)} seconds`,
		);

		// //If elapsed > TTL, we may not renew it since it is too late
		// if(elapsed.asSeconds() > Number(Global.envParam("token_ttl_seconds")))
		// 	throw new Error("token_expire");

		//Otherwise we renew it
		await Database.table("user_sessions").findOneAndUpdate(
			{ token: token },
			{ update_time: new Date(FmtTime.now().toISOString()) },
		);

		return user;
	}

	static async activateToken(token: string, authCode: number) {
		if (!uuid.validate(token))
			throw new WebError("invalid_token", "auth", 403);

		const entry: any = await Database.table("user_sessions")
			.findOne({ token: token })
			.lean();
		//Logger.info("Token Found!");

		Logger.info(JSON.stringify(entry));

		//Logger.info(`From Entry ${entry.authCode}, from input ${authCode}`);
		if (entry.auth_code != `${authCode}`)
			throw new WebError("invalid_auth_code", "auth", 403);

		await Promise.all([
			Database.table("users").findOneAndUpdate(
				{ user_id: entry.user_id },
				{
					$set: {
						is_active: true,
					},
				},
			),
			Database.table("user_sessions").findOneAndUpdate(
				{ token: token },
				{
					$set: {
						update_time: new Date(FmtTime.now().toISOString()),
						is_active: true,
					},
				},
			),
		]);

		return await Database.table("users")
			.findOne({ user_id: entry.user_id })
			.lean();
	}

	static async init(): Promise<void> {
		const app = NetworkCore.fastifyApp;

		app.get("/auth/login", async (req, res) => {
			try {
				WebUtil.ensureValidParams(req, "email");

				const body = WebUtil.body(req);

				//This returns a FULL token containing things like authCode, createTime, token version, etc.
				const token = await this.login(body);

				WebUtil.onResponse(
					res,
					Util.trimMongoDocument(
						token,
						"auth_code",
						"user_id",
						"is_active",
					),
				);
			} catch (e) {
				WebUtil.onError(req, res, e);
			}
		});

		app.get("/auth/logout", async (req, res) => {
			try {
				WebUtil.ensureValidParams(req, "token");

				await this.logout(WebUtil.body(req)["token"] ?? "");
				WebUtil.onResponse(res, "ok!");
			} catch (e) {
				WebUtil.onError(req, res, e);
			}
		});

		/**
		 * Activate token if authCode is correct.
		 */
		app.get("/auth/token/activate", async (req, res) => {
			try {
				WebUtil.ensureValidParams(req, "token", "auth_code");

				const params = WebUtil.body(req),
					token = params["token"],
					authCode = params["auth_code"];

				//Return user info upon activation
				const user = await this.activateToken(token, authCode);

				WebUtil.onResponse(res, Util.trimMongoDocument(user));
			} catch (e) {
				WebUtil.onError(req, res, e);
			}
		});

		/**
		 * Renew token upon
		 */
		app.get("/auth/token/renew", async (req, res) => {
			try {
				WebUtil.ensureValidParams(req, "token");

				const token = WebUtil.body(req)["token"] ?? "";
				const user = await this.renewToken(token);

				WebUtil.onResponse(res, Util.trimMongoDocument(user));
			} catch (e) {
				WebUtil.onError(req, res, e);
			}
		});

		//Validate Token (not activate!Just verify if the token is still valid and active)
		app.get("/auth/token/validate", async (req, res) => {
			try {
				WebUtil.ensureValidParams(req, "token");

				//This will validate token and user status(yes!)
				const user = await this.getUserWithToken(
					WebUtil.body(req).token,
				);

				WebUtil.onResponse(res, Util.trimMongoDocument(user));
			} catch (e) {
				WebUtil.onError(req, res, e);
			}
		});

		NetworkCore.fastifyApp.get("/auth/user/info/self", async (req, res) => {
			try {
				WebUtil.ensureValidParams(req, "token");

				const body = WebUtil.body(req);

				WebUtil.onResponse(
					res,
					Util.trimMongoDocument(
						await this.getUserWithToken(body["token"]),
						//await this.getUserByEmail(body["email"]),
					),
				);
			} catch (e) {
				WebUtil.onError(req, res, e);
			}
		});

		NetworkCore.fastifyApp.get(
			"/auth/user/info/others",
			async (req, res) => {
				try {
					WebUtil.ensureValidParams(req, "email", "token");

					const body = WebUtil.body(req);

					await this.getUserWithToken(body["token"]);

					WebUtil.onResponse(
						res,
						Util.trimMongoDocument(
							await this.getUserByEmail(body["email"]),
						),
					);
				} catch (e) {
					WebUtil.onError(req, res, e);
				}
			},
		);

		NetworkCore.fastifyApp.get(
			"/auth/admin/user/info",
			async (req, res) => {
				try {
					WebUtil.ensureValidParams(req, "password", "email");

					const body = WebUtil.body(req);

					if (body["password"] != Global.envParam("ROOT_PASS", "")) {
						throw Error("incorrect password!");
					}

					WebUtil.onResponse(
						res,
						Util.trimMongoDocument(
							await this.getUserByEmail(body["email"]),
						),
					);
				} catch (e) {
					WebUtil.onError(req, res, e);
				}
			},
		);

		//Admin API to manually add users, has to use whatever is set in env as ROOT_PASS to invoke
		NetworkCore.fastifyApp.get("/auth/admin/user/add", async (req, res) => {
			try {
				WebUtil.ensureValidParams(req, "password");

				const body = WebUtil.body(req);

				if (body["password"] != Global.envParam("ROOT_PASS", "")) {
					throw Error("incorrect password!");
				}

				await this.addUser(body, undefined);
				WebUtil.onResponse(res, { status: "ok" });
			} catch (e) {
				WebUtil.onError(req, res, e);
			}
		});

		//TODO: Add API calls here
	}
}
