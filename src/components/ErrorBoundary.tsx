import React, { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Uncaught error in WordQuill:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#F6F1E7] text-[#1B1815] dark:bg-[#1B1815] dark:text-[#F6F1E7]">
          <div className="max-w-md w-full text-center rounded-2xl border border-black/[0.08] bg-[#FAF6EE] p-8 dark:border-white/[0.08] dark:bg-[#221E1B]">
            <h1 className="font-fraunces text-2xl font-medium tracking-tight">
              An unexpected pause
            </h1>
            <p className="mt-3 text-sm text-[#8C8272] leading-relaxed">
              WordQuill encountered a transient error. Your vocabulary progress remains safely stored on your device.
            </p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={this.handleReload}
                className="rounded-xl bg-[#D98A93] px-6 py-2.5 text-xs font-medium text-[#1B1815] hover:opacity-90 active:scale-95 transition cursor-pointer"
              >
                Reload Lexicon
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
