import { attest } from '@ark/attest';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  InferIO,
  InheritArgNames,
  IOLayout,
} from '../src/core/function/fnTypes.ts';
import * as d from '../src/data/index.ts';
import tgpu, { type TgpuFn, type TgpuFnShell } from '../src/index.ts';
import { parse, parseResolved } from './utils/parseResolved.ts';
import { Void } from '../src/data/wgslTypes.ts';
import type { Prettify } from '../src/shared/utilityTypes.ts';

describe('tgpu.fn', () => {
  it('should inject function declaration of called function', () => {
    const emptyFn = tgpu['~unstable']
      .fn([])(`() {
        // do nothing
      }`)
      .$name('empty');

    const actual = parseResolved({ emptyFn });

    const expected = parse('fn empty() {}');

    expect(actual).toBe(expected);
  });

  it('should inject function declaration only once', () => {
    const emptyFn = tgpu['~unstable']
      .fn([])(`() {
        // do nothing
      }`)
      .$name('empty');

    const actual = parseResolved({
      main: tgpu['~unstable']
        .fn([])(`
          () {
            emptyFn();
            emptyFn();
          }`)
        .$uses({ emptyFn })
        .$name('main'),
    });

    const expected = parse(`
      fn empty() {}

      fn main() {
        empty();
        empty();
      }
    `);

    expect(actual).toBe(expected);
  });

  it('should inject function declaration only once (calls are nested)', () => {
    const emptyFn = tgpu['~unstable']
      .fn([])(`() {
        // do nothing
      }`)
      .$name('empty');

    const nestedAFn = tgpu['~unstable']
      .fn([])(`() {
        emptyFn();
      }`)
      .$uses({ emptyFn })
      .$name('nested_a');

    const nestedBFn = tgpu['~unstable']
      .fn([])(`() {
        emptyFn();
      }`)
      .$uses({ emptyFn })
      .$name('nested_b');

    const actual = parseResolved({
      main: tgpu['~unstable']
        .fn([])(`() {
          nestedAFn();
          nestedBFn();
        }`)
        .$uses({ nestedAFn, nestedBFn })
        .$name('main'),
    });

    const expected = parse(`
      fn empty() {}

      fn nested_a() {
        empty();
      }

      fn nested_b() {
        empty();
      }

      fn main() {
        nested_a();
        nested_b();
      }
    `);

    expect(actual).toBe(expected);
  });

  it('creates typed shell from parameters', () => {
    const proc = tgpu['~unstable'].fn([]);
    const one = tgpu['~unstable'].fn([d.f32]);
    const two = tgpu['~unstable'].fn([d.f32, d.u32]);

    expectTypeOf(proc).toEqualTypeOf<TgpuFnShell<[], d.Void>>();
    expectTypeOf<ReturnType<typeof proc>>().toEqualTypeOf<
      TgpuFn<() => d.Void>
    >();

    expectTypeOf(one).toEqualTypeOf<TgpuFnShell<[d.F32], d.Void>>();
    expectTypeOf<ReturnType<typeof one>>().toEqualTypeOf<
      TgpuFn<(arg_0: d.F32) => d.Void>
    >();

    expectTypeOf(two).toEqualTypeOf<TgpuFnShell<[d.F32, d.U32], d.Void>>();
    expectTypeOf<ReturnType<typeof two>>().toEqualTypeOf<
      TgpuFn<(arg_0: d.F32, arg_1: d.U32) => d.Void>
    >();
  });

  it('creates typed shell from parameters and return type', () => {
    const proc = tgpu['~unstable'].fn([], d.bool);
    const one = tgpu['~unstable'].fn([d.f32], d.bool);
    const two = tgpu['~unstable'].fn([d.f32, d.u32], d.bool);

    expectTypeOf(proc).toEqualTypeOf<TgpuFnShell<[], d.Bool>>();
    expectTypeOf<ReturnType<typeof proc>>().toEqualTypeOf<
      TgpuFn<() => d.Bool>
    >();

    expectTypeOf(one).toEqualTypeOf<TgpuFnShell<[d.F32], d.Bool>>();
    expectTypeOf<ReturnType<typeof one>>().toEqualTypeOf<
      TgpuFn<(arg_0: d.F32) => d.Bool>
    >();

    expectTypeOf(two).toEqualTypeOf<TgpuFnShell<[d.F32, d.U32], d.Bool>>();
    expectTypeOf<ReturnType<typeof two>>().toEqualTypeOf<
      TgpuFn<(arg_0: d.F32, arg_1: d.U32) => d.Bool>
    >();
  });
});

describe('tgpu.computeFn', () => {
  it('does not create In struct when the are no arguments', () => {
    const foo = tgpu['~unstable'].computeFn({ workgroupSize: [1] })(() => {
      const x = 2;
    });

    expect(parseResolved({ foo })).not.toContain('struct');
    expect(foo.shell.argTypes).toStrictEqual([]);
  });

  it('does not create In struct when there is empty object for arguments', () => {
    const foo = tgpu['~unstable'].computeFn({ in: {}, workgroupSize: [1] })(
      () => {
        const x = 2;
      },
    );

    expect(parseResolved({ foo })).not.toContain(parse('struct'));
    expect(foo.shell.argTypes).toStrictEqual([]);
  });
});

describe('tgpu.vertexFn', () => {
  it('does not create In struct when the are no arguments', () => {
    const foo = tgpu['~unstable'].vertexFn({
      out: { pos: d.builtin.position },
    })(() => ({
      pos: d.vec4f(),
    }));
    expect(parseResolved({ foo })).not.toContain(parse('struct foo_In'));
    expect(parseResolved({ foo })).toContain(parse('struct foo_Out'));
    expect(foo.shell.argTypes).toStrictEqual([]);
  });

  it('does not create In struct when there is empty object for arguments', () => {
    const foo = tgpu['~unstable'].vertexFn({
      in: {},
      out: { pos: d.builtin.position },
    })(() => {
      return {
        pos: d.vec4f(),
      };
    });
    expect(parseResolved({ foo })).not.toContain(parse('struct foo_In'));
    expect(parseResolved({ foo })).toContain(parse('struct foo_Out'));
    expect(foo.shell.argTypes).toStrictEqual([]);
  });
});

describe('tgpu.fragmentFn', () => {
  it('does not create In struct when the are no arguments', () => {
    const foo = tgpu['~unstable'].fragmentFn({
      out: d.vec4f,
    })(() => d.vec4f(0));

    expect(parseResolved({ foo })).not.toContain(parse('struct'));
    expect(foo.shell.argTypes).toStrictEqual([]);
  });

  it('does not create In struct when there is empty object for arguments', () => {
    const foo = tgpu['~unstable'].fragmentFn({
      in: {},
      out: d.vec4f,
    })(() => d.vec4f(0));

    expect(parseResolved({ foo })).not.toContain(parse('struct'));
    expect(foo.shell.argTypes).toStrictEqual([]);
  });

  it('does not create Out struct when the are no output parameters', () => {
    const foo = tgpu['~unstable'].fragmentFn({ out: Void })(() => {});
    expect(parseResolved({ foo })).not.toContain(parse('struct foo_Out'));
  });
});

describe('InferIO', () => {
  it('unwraps f32', () => {
    const layout = d.f32 satisfies IOLayout;

    expectTypeOf<InferIO<typeof layout>>().toEqualTypeOf<number>();
  });

  it('unwraps a record of numeric primitives', () => {
    const layout = { a: d.f32, b: d.location(2, d.u32) } satisfies IOLayout;

    expectTypeOf<InferIO<typeof layout>>().toEqualTypeOf<{
      a: number;
      b: number;
    }>();
  });
});

describe('InheritArgNames', () => {
  it('should inherit argument names from one fn to another', () => {
    const isEven = (x: number) => (x & 1) === 0;
    const identity = (num: number) => num;
    // Should have the same argument names as `identity`, but the signature of `isEven`
    const isEvenWithNames = undefined as unknown as Prettify<
      InheritArgNames<
        typeof isEven,
        typeof identity
      >
    >['result'];

    attest(isEven).type.toString.snap('(x: number) => boolean');
    attest(identity).type.toString.snap('(num: number) => number');
    attest(isEvenWithNames).type.toString.snap('(num: number) => boolean');
  });
});
