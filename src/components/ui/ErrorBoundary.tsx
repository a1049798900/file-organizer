import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { EmptyState } from './EmptyState';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义兜底内容，默认展示列表加载失败提示 */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <EmptyState text="列表加载失败" subtext="请刷新后重试" icon="file" />
        )
      );
    }
    return this.props.children;
  }
}
