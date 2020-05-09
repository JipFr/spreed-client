import { Application, Router, Context } from "https://deno.land/x/denotrain@v0.3.1/mod.ts";
import { TrainStatic } from "https://deno.land/x/denotrain@v0.3.1/middleware/static/mod.ts";
import { Client, Message, Channel } from "https://deno.land/x/talk_lib/mod.ts"
import { UserClients } from "./classes.ts";

const app: Application = new Application({ port: 8081 });
const userClients: UserClients = {}

app.use(ctx => {
	ctx.res.addHeader("Access-Control-Allow-Origin", "*");
	return;
});

app.post("/getData", async (ctx: Context) => {
	let query = ctx.req.query;
	console.log(query);
	if(query.auth) {
		let client = await getClient(query.auth.toString());


		let messages: Message[] = [];
		if(query.room) {
			let room = client.channels.find((room: Channel) => room.token === query.room);
			if(room) {
				messages = await room.fetchMessages();
			}
			console.log(room?.name, room?.token);
		}


		let channels = Object.assign([], client.channels);
		channels.forEach((ch: Channel) => {
			delete ch.client;
		});

		return {
			channels,
			messages
		}
	} else {
		return {
			status: 403
		}
	}
});

app.use("/", new TrainStatic("./public"));


/** Get Client object based on user's authentication */
async function getClient(auth: string) {
	if(!userClients[auth]) {
		userClients[auth] = new Client({
			url: "box.ictmaatwerk.com",
			encoded: auth
		});
		await userClients[auth].start();
	}
	return userClients[auth];
}


await app.run();
console.log(1);