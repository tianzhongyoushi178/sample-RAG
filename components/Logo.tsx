import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "" }) => {
    return (
        <div className={`flex items-center gap-3 px-2 ${className}`}>
            <div className="relative w-8 h-8 flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-sky-600">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-sky-100 rounded-full flex items-center justify-center border border-sky-200">
                    <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse"></div>
                </div>
            </div>
            <div>
                <h1 className="font-bold text-gray-800 text-lg leading-tight tracking-tight">Knowledge<span className="text-sky-600">Base</span></h1>
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">AI Powered</p>
            </div>
        </div>
    );
};
