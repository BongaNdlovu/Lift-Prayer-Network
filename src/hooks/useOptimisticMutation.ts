import { useCallback, useState } from 'react';

type MutationFn<TVars, TResult> = (variables: TVars) => Promise<TResult>;

type UseOptimisticOptions<TVars, TResult, TContext> = {
  mutation: MutationFn<TVars, TResult>;
  onMutate?: (variables: TVars) => TContext | void;
  onError?: (error: any, variables: TVars, context?: TContext) => void;
  onSuccess?: (result: TResult, variables: TVars, context?: TContext) => void;
};

export const useOptimisticMutation = <TVars = void, TResult = void, TContext = unknown>(
  options: UseOptimisticOptions<TVars, TResult, TContext>,
) => {
  const { mutation, onMutate, onError, onSuccess } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(
    async (vars: TVars) => {
      setLoading(true);
      setError(null);
      let context: TContext | undefined;

      try {
        if (onMutate) {
          context = onMutate(vars) ?? undefined;
        }
        const result = await mutation(vars);
        if (onSuccess) {
          onSuccess(result, vars, context as TContext | undefined);
        }
        return result;
      } catch (err: any) {
        const wrapped = err instanceof Error ? err : new Error(err?.message || 'Unexpected error');
        setError(wrapped);
        if (onError) {
          onError(wrapped, vars, context as TContext | undefined);
        }
        throw wrapped;
      } finally {
        setLoading(false);
      }
    },
    [mutation, onMutate, onSuccess, onError],
  );

  const resetError = useCallback(() => setError(null), []);

  return {
    mutate: run,
    loading,
    error,
    resetError,
  };
};

