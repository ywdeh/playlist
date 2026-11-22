import { describe, report } from '#lib/server/spotify';

type Caught = { kind: string; error: unknown };

export const handleError = ({ kind, error }: Caught) => {
	if (kind === 'unknown') {
		report('unexpected', error);
		return { message: describe(error).message };
	}
	const known = error as { status?: number; message: string };
	if (known.status === 404) return { message: 'this page doesn’t exist' };
	return { message: known.message };
};
