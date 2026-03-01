// =================================================================================
//                               PERLIN NOISE (2D)
// =================================================================================
// We implement a compact, deterministic 2D Perlin:
// - A seedable xorshift32 RNG shuffles a 0..255 array into a permutation table.
//   Why xorshift? Tiny, fast, deterministic — perfect for shuffling; cryptographic
//   quality is unnecessary here.
// - Quintic fade (6t^5-15t^4+10t^3) ensures C2 continuity at lattice boundaries,
//   preventing creases where cells meet.
// - Hash-derived gradient directions avoid storing a gradient table yet keep uniform
//   angular spread (8 directions).
// - Standard bilinear interpolation with faded weights blends the 4 corner grads.

export class Perlin2D {
	private static _instances: Record<number, Perlin2D> = {};
	private perm: number[]; // 512-length perm table (0..255 duplicated) for fast, wraparound indexing

	public static getInstance(seed?: number): Perlin2D {
		if (!this._instances[seed ?? 1337]) {
			this._instances[seed ?? 1337] = new Perlin2D(seed);
		}
		return this._instances[seed ?? 1337];
	}

	constructor(seed = 1337) {
		// --- Seeded RNG (xorshift32) — tiny & fast, good enough for permutation shuffle ---
		// In other words, a fancy way to make a "pseudorandom number generator"
		let state = seed | 0 || 1; // force 32-bit int; avoid 0 state by falling back to 1
		const random = () => {
			// Advance the state using xorshift recipe (Marsaglia):
			state ^= state << 13; // mix high bits into low by left shift and XOR
			state ^= state >>> 17; // spread entropy across the word with right shift XOR
			state ^= state << 5; // another left shift XOR to finish the cycle
			// // Convert unsigned 32-bit int to [0,1) float
			return (state >>> 0) / 0xffffffff;
		};

		// Build base array [0..255]
		const permutation: number[] = Array.from({ length: 256 }, (_, i) => i);

		// Fisher-Yates shuffle using our seeded RNG for reproducibility
		// In other words, a fancy way to "randomize" the array
		// Pseudo-random, but deterministic given the same seed
		for (let currentIndex = 255; currentIndex > 0; currentIndex--) {
			const randomIndex = Math.floor(random() * (currentIndex + 1));
			[permutation[currentIndex], permutation[randomIndex]] = [permutation[randomIndex], permutation[currentIndex]]; // swap
		}

		// Duplicate to 512 to allow cheap indexing with i & 255 and i+1 without bounds checks
		this.perm = new Array(512);
		for (let i = 0; i < 512; i++) this.perm[i] = permutation[i & 255]; // i & 255 == i % 256
	}

	// Quintic fade: smoothstep with zero first/second derivatives at t=0 and t=1.
	// Prevents visible grid seams when interpolating across cells.
	// (6t^5-15t^4+10t^3) https://www.desmos.com/calculator/ykrjhcst6v
	private fade(weight: number) {
		return weight * weight * weight * (weight * (6 * weight - 15) + 10);
	}

	// Derive a small set of 2D gradient directions from the hashed corner index.
	// A dot product of the gradient and the (x,y) offset from the corner gives
	// This calculates the alignment of our pseudorandom gradient value with XY
	// and is used to determine the behaviour of the slope between the points.
	private grad(cornerHash: number, x: number, y: number): number {
		// We have 8 possible directions (N,NE,E,SE,S,SW,W,NW)
		const direction = cornerHash & 7; // 0..7 → choose among 8 directions
		const primary = direction < 4 ? x : y; // select primary component
		const secondary = direction < 4 ? y : x; // select secondary component
		// Assign signs based on low bits; compute dot product with (x,y)
		const gradX = (direction & 1) === 0 ? 1 : -1; // primary sign
		const gradY = (direction & 2) === 0 ? 1 : -1; // secondary sign
		// return gradX * primary + gradY * secondary; // dot product with (x,y)
		return gradX * primary + gradY * secondary;
	}

	// Linear interpolation between a and b with weight t
	private lerp(weight: number, start: number, end: number) {
		return start + weight * (end - start);
	}

	// Raw Perlin value in roughly [-1, 1]
	noise(x: number, y: number): number {
		// Locate integer cell (X,Y) and fractional offset inside it (xf,yf)
		const cellX = Math.floor(x) & 255; // wrap to 0..255 for perm indexing
		const cellY = Math.floor(y) & 255;
		const offsetX = x - Math.floor(x); // 0..1
		const offsetY = y - Math.floor(y);

		// Compute eased weights along x and y
		const fadedX = this.fade(offsetX);
		const fadedY = this.fade(offsetY);

		// Hash 4 corners of the cell
		// (Find pseudo-random gradient indices for each corner using permutation table)
		// grab a random cell indexed by cellX then use that value to index cellY
		const cornerHash00 = this.perm[this.perm[cellX] + cellY];
		const cornerHash01 = this.perm[this.perm[cellX] + cellY + 1];
		const cornerHash10 = this.perm[this.perm[cellX + 1] + cellY];
		const cornerHash11 = this.perm[this.perm[cellX + 1] + cellY + 1];

		// Dot products of gradients with offsets, then bilinear interpolate with eased weights
		const startBottom = this.grad(cornerHash00, offsetX, offsetY); // bottom-left corner
		const endBottom = this.grad(cornerHash10, offsetX - 1, offsetY); // bottom-right corner
		const interpolatedBottom = this.lerp(fadedX, startBottom, endBottom);

		const startTop = this.grad(cornerHash01, offsetX, offsetY - 1); // top-left corner
		const endTop = this.grad(cornerHash11, offsetX - 1, offsetY - 1); // top-right corner
		const interpolatedTop = this.lerp(fadedX, startTop, endTop);

		return this.lerp(fadedY, interpolatedBottom, interpolatedTop);
	}

	// Fractal Brownian Motion: sum octaves with increasing frequency and decaying amplitude,
	// then normalize by total amplitude to keep overall range stable across octave counts.
	fbm(x: number, y: number, octaves: number, persistence: number): number {
		let amplitude = 1; // starting amplitude
		let frequency = 1; // starting frequency
		let noiseSum = 0; // accumulated value
		let totalAmplitude = 0; // accumulated amplitude for normalization

		for (let octave = 0; octave < octaves; octave++) {
			noiseSum += this.noise(x * frequency, y * frequency) * amplitude; // sample at current freq, scale by amp
			totalAmplitude += amplitude; // track amplitude sum
			amplitude *= persistence; // next octave is quieter
			frequency *= 2; // and higher frequency
		}
		return noiseSum / totalAmplitude; // keep output roughly within [-1,1] regardless of octave count
	}
}
