interface Env {
	SITE: { fetch(input: string): Promise<Response> };
}

export default {
	async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
		ctx.waitUntil(
			env.SITE.fetch('https://music.hedwy.art/api/plays').then(async (res) => {
				if (!res.ok) console.error(`play log sync failed: ${res.status} ${await res.text()}`);
			})
		);
	}
};
