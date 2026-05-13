import React from 'react';
import { LiftErrorState, LiftScreen } from './LiftLayout';
import { lightImpact } from '../utils/haptics';

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export const ErrorState: React.FC<Props> = ({ title = 'Something went wrong', message, onRetry }) => (
  <LiftScreen contentStyle={{ justifyContent: 'center' }}>
    <LiftErrorState
      title={title}
      message={message}
      onRetry={onRetry ? () => {
        lightImpact();
        onRetry();
      } : undefined}
    />
  </LiftScreen>
);

