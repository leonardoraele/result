# Result

`Result` is a tiny JS library that provides an object to encapsulate the result of a synchronous operation.

It is inspired by Rust's Result type and JS's Promise* interface (* but applied in a synchronous context).

## Install

	npm install @leonardoraele/result

## Usage

### Creating a `Result` object

#### `ok()` and `err()`

```js
import { Result } from '@leonardoraele/result';

// Use `ok()` and `err()` to create Result objects. A Result object either
// represents a successful operation and optionally holds a value, or
// represents a failure and holds an error object.
function divide(dividend, divisor) {
	if (divisor === 0) {
		return Result.err('Cannot divide by zero.');
	}
	return Result.ok(dividend / divisor);
}
```

#### `ifThruthy()`

```js
import { Result } from '@leonardoraele/result';

// `ifTruthy()` returns a successful Result object wrapping the provided value
// if the provided value is truthy. Otherwise, it returns `undefined` so you can
// provide a fallback value using the `??` operator.
const result = Result.ifTruthy([1, 2, 3].includes(4))
	?? Result.err('Failed to find item.');
```

#### `attempt()`

```js
import fs from 'node:fs';
import { attempt } from '@leonardoraele/result';

// The `attempt()` function never throws. It return a Result object that either
// contains the return value of the function or the error, if it throws.
const result = attempt(() => fs.readFileSync('some_file.txt'));
```

### `wrap()`

```js
import { Result } from '@leonardoraele/result';
import { doSomething } from './somewhere';

// You can use `wrap()` to wrap a function so that anything the function returns
// or throws is wrapped into a Result object. The resulting function never
// throws. This is similar to the`attempt()` function, except it creates a new
// function that calls the underlying function instead of calling it immediately.
const attemptSomething = Result.wrap(doSomething);

const result = attemptSomething();
```

### Using a `Result` object

#### `isOk()`, `isErr()`, `.value`, and `.error`

```js
const result = doSomething();

// Use `.isOk()` and `.isErr()` to check if the operation was successful or not.
if (result.isErr()) {
	// If it's an error, use `result.error.cause` to access the error thrown by
	// the `attempt()` callback.
	console.log('An error occured:', result.error.cause);
}

if (result.isOk()) {
	// If it's ok, use the `result.value` to access the value returned by the
	// `attempt()` callback.
	console.log('File read successfully:', result.value);
}
```

#### `raises()` and `rescue()`

```js
import { Result } from '@leonardoraele/result';

function divide(dividend, divisor) {
	if (divisor === 0) {
		return Result.err('Cannot divide by zero.');
	}
	return Result.ok(dividend / divisor);
}

// Use `.raises()` method to "unwrap" the value out of a Result object if it's a
// success. It throws if the Result contains an error.
assert(5 === divide(10, 2).raises());
assert.throws(() => divide(10, 0).raises());

// Use `.rescue()` method to "unwrap" the value out of the Result object, with a
// a fallback function that provides a value if the Result object is an error.
assert(5 === divide(10, 2).rescue(() => 0)); // Rescue function is never called.
assert(Infinity === divide(10, 0).resuce(() => Infinity));
```

#### `map()` and `mapErr()`

```js
import { attempt } from '@leonardoraele/result';

function divide(dividend, divisor) {
	if (divisor === 0) {
		return Result.err('Cannot divide by zero.');
	}
	return Result.ok(dividend / divisor);
}

// Call `.map()` to map a successful result to a new value. If the Result object
// is an error, calls to the `map()` method are ignored.
assert(2.5 === divide(10, 2).map(r => divide(r, 2)));
assert(divide(10, 0).map(r => divide(r, 2)).isErr()); // The mapping function is never called

// Call `.mapErr()` to map an error result to a different error. If the Result
// object is successful, calls to the `mapErr()` method are ignored.
assert(divide(10, 0).error.message === 'Cannot divide by zero.');

const result = divide(10, 0)
	.mapErr(e => new Error('Division error.', { cause: e }));
assert(result.isErr());
assert(result.error.message === 'Division error.');
assert(result.error.cause.message === 'Cannot divide by zero.');
```
