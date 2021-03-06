import { Application, Context } from "https://deno.land/x/abc@v1.3.1/mod.ts";
import { renderFile } from "https://deno.land/x/dejs/mod.ts";
import { Client, Message, Channel } from "https://raw.githubusercontent.com/JipFr/talk-lib/master/mod.ts"
import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import { UserClients } from "./classes.ts";
import { getEmbed } from "./embed.ts";


interface ImageCache {
	/** User id with UINT8array */
	[key: string]: Uint8Array;
}
let iconCache: ImageCache = {};
let previewCache: ImageCache = {};

let toHTML = (str: string) => {
	let html = Marked.parse(str).content;
	return html;
}

const app: Application = new Application();
const userClients: UserClients = {}

app.renderer = {
	render<T>(name: string, data: T): Promise<Deno.Reader> {
		return renderFile(name, data);
	},
};

app.get("/", async (ctx: Context) => {
	await ctx.render("./public/index.html");
});

app.get("/getEmbed", async (ctx: Context) => {
	let embed = await getEmbed(ctx.queryParams.url as string);
	return embed;
});

app.post("/getData", async (ctx: Context) => {
	let query = await ctx.body as {[key: string]: string};
	if(query.auth) {
		let auth = query.auth.toString();
		let client = await getClient(auth);

		let messages: Message[] = [];
		if(query.room) {
			let room = client.channels.find((room: Channel) => room.token === query.room);
			if(room) {
				messages = await room.fetchMessages();
				// console.log(room.unreadMessages);
				// if(room.unreadMessages) {
				// 	let token = room.token;
				// 	let x = await fetch(`https://box.ictmaatwerk.com/ocs/v2.php/apps/spreed/api/v1/chat/${token}/read`, {
				// 		method: "POST",
				// 		headers: {
				// 			"Ocs-Apirequest": "true",
				// 			"Accept": "application/json, text/plain, */*",
				// 			"Authorization": `Basic ${auth}`
				// 		}
				// 	});
				// 	console.log(x, await x.text());
				// }
			}
		}


		let channels = [...client.channels.map(obj => Object.assign({}, obj))];
		channels.forEach((ch: Channel) => {
			delete ch.client;
		});
		messages = [...messages.map(obj => Object.assign({}, obj))];
		messages.forEach((msg: Message) => {
			msg.channel = Object.assign({}, msg.channel);
			msg.content = toHTML(msg.content);
			delete msg.channel.client;
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

interface PostMessageOptions {
	[key: string]: string;
}

app.post("/postMessage", async (ctx: Context) => {
	let query = await ctx.body as PostMessageOptions;
	if(query.auth && query.room) {
		let client = await getClient(query.auth.toString());

		let messages: Message[] = [];
		if(query.room) {
			let room = client.channels.find((room: Channel) => room.token === query.room);
			if(room && query.v && typeof query.v === "string") {
				room.send(query.v);
			}
		}
		
		return {
			status: 200
		}
	} else {
		return {
			status: 403
		}
	}
});

app.static("/", "public");

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

app.get("/image/:id", async (ctx) => {
	if(!iconCache[ctx.params.id]) {
		let avatarReq = await fetch(`https://box.ictmaatwerk.com/avatar/${ctx.params.id}/256`, {
			headers: {
				"Ocs-Apirequest": "true",
				"Accept": "application/json, text/plain, */*",
				"Authorization": `Basic ${ctx.queryParams.auth}`
			}
		});
		// This will succeed
		let buffer = await avatarReq.arrayBuffer();
		let arr = new Uint8Array(buffer);
		iconCache[ctx.params.id] = arr;
		return arr;
	} else {
		return iconCache[ctx.params.id];
	}
});

app.get("/image-preview/:id", async ctx => {
	if(!previewCache[ctx.params.id]) {
		let avatarReq = await fetch(`https://box.ictmaatwerk.com/core/preview?fileId=${ctx.params.id}&x=1920&y=1080&a=true`, {
			headers: {
				"Ocs-Apirequest": "true",
				"Accept": "application/json, text/plain, */*",
				"Authorization": `Basic ${ctx.queryParams.auth}`
			}
		});

		let buffer = await avatarReq.arrayBuffer();
		let arr = new Uint8Array(buffer);
		previewCache[ctx.params.id] = arr;

		return arr;
	} else {
		return previewCache[ctx.params.id];
	}
});

// Used for proxying via.placeholder.com so that we can use toDataURL it to cache it on the client-side
app.get("/placeholderImage/:resolution/:colorA/:colorB", async (ctx) => {
	let avatarReq = await fetch(`https://via.placeholder.com/${ctx.params.resolution}.png/${ctx.params.colorA}/${ctx.params.colorB}?text=${ctx.queryParams.text || "%20"}`, {});
	let buffer = await avatarReq.arrayBuffer();
	let arr = new Uint8Array(buffer);
	return arr;
});

await app.start({ port: 8081 });
console.log("Started!");