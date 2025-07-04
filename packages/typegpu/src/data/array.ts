import type {
  Infer,
  InferGPU,
  InferPartial,
  MemIdentity,
} from '../shared/repr.ts';
import type {
  $gpuRepr,
  $memIdent,
  $repr,
  $reprPartial,
} from '../shared/symbols.ts';
import { $internal } from '../shared/symbols.ts';
import { sizeOf } from './sizeOf.ts';
import type { AnyWgslData, BaseData, WgslArray } from './wgslTypes.ts';

// ----------
// Public API
// ----------

/**
 * Creates an array schema that can be used to construct gpu buffers.
 * Describes arrays with fixed-size length, storing elements of the same type.
 *
 * @example
 * const LENGTH = 3;
 * const array = d.arrayOf(d.u32, LENGTH);
 *
 * @param elementType The type of elements in the array.
 * @param elementCount The number of elements in the array.
 */
export function arrayOf<TElement extends AnyWgslData>(
  elementType: TElement,
  elementCount: number,
): WgslArray<TElement> {
  return new WgslArrayImpl(elementType, elementCount);
}

// --------------
// Implementation
// --------------

class WgslArrayImpl<TElement extends BaseData> implements WgslArray<TElement> {
  public readonly [$internal] = true;
  public readonly type = 'array';

  // Type-tokens, not available at runtime
  declare readonly [$repr]: Infer<TElement>[];
  declare readonly [$gpuRepr]: InferGPU<TElement>[];
  declare readonly [$reprPartial]: {
    idx: number;
    value: InferPartial<TElement>;
  }[];
  declare readonly [$memIdent]: WgslArray<MemIdentity<TElement>>;
  // ---

  constructor(
    public readonly elementType: TElement,
    public readonly elementCount: number,
  ) {
    if (Number.isNaN(sizeOf(elementType))) {
      throw new Error('Cannot nest runtime sized arrays.');
    }

    if (!Number.isInteger(elementCount) || elementCount < 0) {
      throw new Error(
        `Cannot create array schema with invalid element count: ${elementCount}.`,
      );
    }
  }

  toString() {
    return `arrayOf(${this.elementType})`;
  }
}
