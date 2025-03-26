import { Err } from '@leonardoraele/err';
import assert from 'node:assert';

assert.throws

// ---------------------------------------------------
// Augment the `Err` class with the `toResult` method.
declare module '@leonardoraele/err' {
	interface Err {
		toResult(): FailureResult<any>;
	}
}
Err.prototype.toResult = function () {
	return Result.err(this);
};
// ---------------------------------------------------

export type Result<T = void> = SuccessResult<T>|FailureResult<T>;

export namespace Result {
	export function ok(): SuccessResult<void>;
	export function ok<T>(value: SuccessResult<T>): SuccessResult<T>;
	export function ok(value: FailureResult<any>): SuccessResult<Error>;
	export function ok<T>(value: T): SuccessResult<T>;
	export function ok(...params: unknown[]): SuccessResult<any> {
		return params.length === 0 ? SuccessResult.VOID
			: params[0] instanceof SuccessResult ? params[0]
			: params[0] instanceof FailureResult ? new SuccessResult(params[0].error)
			: new SuccessResult(params[0] as any);
	}

	export function err<T = any>(error: Error|string): FailureResult<T> {
		return typeof error === 'string'
			? err(new Err(error))
			: new FailureResult<T>(Err.from(error));
	}

	export function ifTruthy<T>(value: T|null|undefined): SuccessResult<T>|undefined {
		return Boolean(value) ? ok(value!) : undefined;
	}

	export function attempt<T>(fn: () => T): Result<T> {
		try {
			return ok(fn());
		} catch (error) {
			return err(Err.from(error));
		}
	}

	type Callable<ThisType = any, ParamTypes extends any[] = any[], ReturnType = any> = (this: ThisType, ...args: ParamTypes) => ReturnType;
	type WrapResult<F extends Callable> = (this: ThisParameterType<F>, ...args: Parameters<F>) => Result<ReturnType<F>>;

	export function wrap<F extends Callable>(fn: F): WrapResult<F>;
	export function wrap<F extends Callable>(message: string, fn: F): WrapResult<F>;
	export function wrap<F extends Callable>(arg0: any, arg1?: any): WrapResult<F> {
		const message = typeof arg0 === 'string' ? arg0 : undefined;
		const fn = typeof arg0 === 'function' ? arg0 : arg1!;
		return function (this: ThisParameterType<F>, ...args: Parameters<F>): Result<ReturnType<F>> {
			try {
				return ok(fn.apply(this, args));
			} catch (thrown) {
				let error = Err.from(thrown);
				if (message) {
					error = error.causes(message);
				}
				return err(error);
			}
		};
	}

	// export function assert(...args: Parameters<typeof Err.assert>): Result<void> {
	// 	return attempt(() => Err.assert(...args));
	// }
}

export const { ok, err, ifTruthy, attempt } = Result;

abstract class BaseResult<T = void> {
	abstract isOk(): this is SuccessResult<T>;
	abstract isErr(): this is FailureResult<T>;
	abstract get value(): T|undefined;
	abstract get error(): Err|undefined;

	abstract void(): Result<void>;
	abstract map<R>(fn: (t: T) => R): Result<R>;
	abstract map<R>(fn: (t: T) => Result<R>): Result<R>;
	abstract mapErr(fn: (e: Err) => Err): this;
	// abstract causes(message: string): this;
	abstract rescue(): T|undefined;
	abstract rescue(onerror: (e: Err) => T): T;
	// TODO Drop support to `detailFactory` in favor of receiving a DetailedError object directly.
	abstract raises(message?: string/*, detailFactory?: () => object*/): T;
}

export class SuccessResult<T = void> extends BaseResult<T> {
	static readonly VOID = new SuccessResult<void>();

	readonly #value: T;

	constructor(...params: T extends void ? [] : [T]) {
		super();
		this.#value = params[0] as T;
	}

	override isOk(): this is SuccessResult<T> { return true; }
	override isErr(): this is FailureResult<T> { return false; }
	override get value(): T { return this.#value; }
	override get error(): undefined { return undefined; }

	override void(): SuccessResult<void> { return SuccessResult.VOID; }
	override map<R>(fn: (t: T) => R|Result<R>): Result<R> {
		try {
			const r = fn(this.#value);
			return r instanceof BaseResult ? r : Result.ok(r);
		} catch (error) {
			return Err.from(error).toResult();
		}
	}
	override mapErr(): this { return this; }
	// override causes(): this { return this; }
	override rescue(): T { return this.#value; }
	override raises(): T { return this.#value; }
}

export class FailureResult<T = void> extends BaseResult<T> {
	#error: Err;

	constructor(error: Err) {
		super();
		this.#error = error;
	}

	override isOk(): this is SuccessResult<T> { return false; }
	override isErr(): this is FailureResult<T> { return true; }
	override get value(): T|undefined { return undefined; }
	override get error(): Err { return this.#error; }

	as<R>(): FailureResult<R> { return this as any; }
	override void(): FailureResult<void> { return this.as<void>(); }
	override map<R>(): Result<R> { return this.as<R>(); }
	override mapErr(fn: (e: Err) => Err): this {
		this.#error = fn(this.#error);
		return this;
	}
	// override causes(message: string): this { return this.mapErr(e => e.causes(message)); }
	override rescue(): T|undefined;
	override rescue(onerror: (e: Err) => T): T;
	override rescue(onerror?: (e: Err) => T): T|undefined {
		try {
			return onerror ? onerror(this.#error) : undefined;
		} catch (error) {
			throw error instanceof Err
				? error
				: new Err('Error rescue failed.')
					.with({ originalError: this.#error, rescueError: error });
		}
	}

	override raises(message?: string/*, detailFactory?: () => Record<string, unknown>*/): T {
		if (message) {
			this.#error = this.#error.causes(message);

			// if (detailFactory) {
			// 	this.#error = this.#error.with(detailFactory());
			// }
		}
		throw this.#error;
	}
}
