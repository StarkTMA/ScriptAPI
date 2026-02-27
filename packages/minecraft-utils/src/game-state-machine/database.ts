import { PlayerObject, BranchObject } from "./interfaces";
import { SimpleDatabase, SimpleObject } from "../database";

abstract class ForceSaveDatabase<T extends SimpleObject> extends SimpleDatabase<T> {
	addObject(object: T): void {
		super.addObject(object);
		this.forceSave();
	}

	updateObject(object: T): void {
		super.updateObject(object);
		this.forceSave();
	}

	removeObject(id: string): void {
		super.removeObject(id);
		this.forceSave();
	}

	eraseAllObjects(): void {
		super.eraseAllObjects();
		this.forceSave();
	}
}

export class BranchDatabase extends ForceSaveDatabase<BranchObject> {
	protected static instance: BranchDatabase;
	private constructor() {
		super("branchDatabase", undefined);
	}

	static getInstance(): BranchDatabase {
		if (!BranchDatabase.instance) {
			BranchDatabase.instance = new BranchDatabase();
		}
		return BranchDatabase.instance;
	}
}

export class PlayerDatabase extends ForceSaveDatabase<PlayerObject> {
	protected static instance: PlayerDatabase;
	private constructor() {
		super("playerDatabase", undefined);
	}

	static getInstance(): PlayerDatabase {
		if (!PlayerDatabase.instance) {
			PlayerDatabase.instance = new PlayerDatabase();
		}
		return PlayerDatabase.instance;
	}
}
