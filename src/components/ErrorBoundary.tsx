import { Component, ErrorInfo, ReactNode } from "react";
import { logError } from "../lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#fdfaf5] dark:bg-[#0c0a09] p-4 text-center">
          <div className="max-w-md p-8 bg-white dark:bg-[#1c1917] rounded-3xl shadow-2xl border border-red-200 dark:border-red-900">
            <h1 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-4">عذراً، حدث خطأ غير متوقع</h1>
            <p className="text-[#2d241e] dark:text-[#f5f5f4] mb-6">
              نعتذر عن هذا الخلل. تم تسجيل الخطأ. يرجى محاولة إعادة تحميل الصفحة.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-amber-700 text-white rounded-xl font-bold hover:bg-amber-800 transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
            {import.meta.env.DEV && (
              <pre className="mt-6 p-4 bg-gray-100 dark:bg-[#1c1917] rounded-lg text-left text-xs overflow-auto max-h-40 text-red-500">
                {this.state.error?.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
