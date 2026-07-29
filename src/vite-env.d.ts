import 'react';

declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    orient?: 'vertical' | 'horizontal';
  }
}
