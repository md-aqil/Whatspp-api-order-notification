'use client';

import { TextEffectWrapper } from "@/components/TextEffectWrapper";

const TextEffectExamples = () => {
  const examples = [
    {
      title: "Fade Effect",
      text: "Simple fade in animation",
      preset: "fade",
      className: "text-2xl font-bold text-blue-600"
    },
    {
      title: "Slide Effect",
      text: "Slide in from below",
      preset: "slide",
      className: "text-2xl font-bold text-green-600"
    },
    {
      title: "Scale Effect",
      text: "Scale up animation",
      preset: "scale",
      className: "text-2xl font-bold text-purple-600"
    },
    {
      title: "Blur Effect",
      text: "Blur in while appearing",
      preset: "blur",
      className: "text-2xl font-bold text-amber-600"
    },
    {
      title: "Fade + Blur Effect",
      text: "Combined fade and blur",
      preset: "fade-in-blur",
      className: "text-2xl font-bold text-red-600"
    }
  ];

  return (
    <div className="space-y-8 p-6">
      <h2 className="text-3xl font-bold text-center mb-8">Text Effect Examples</h2>
      
      <div className="grid gap-8">
        {examples.map((example, index) => (
          <div key={example.title} className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">{example.title}</h3>
            <TextEffectWrapper 
              text={example.text}
              preset={example.preset}
              className={example.className}
              delay={index * 0.1}
            />
            <div className="mt-4 text-sm text-gray-600">
              Preset: <code className="bg-gray-100 px-2 py-1 rounded">{example.preset}</code>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Character Segmentation</h3>
        <TextEffectWrapper 
          text="Each character animates individually"
          preset="fade"
          per="char"
          className="text-xl font-bold text-indigo-600"
        />
        <div className="mt-4 text-sm text-gray-600">
          Segmentation: <code className="bg-gray-100 px-2 py-1 rounded">char</code>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Line Segmentation</h3>
        <TextEffectWrapper 
          text={`Line by line animation\nGreat for multiline text`}
          preset="slide"
          per="line"
          className="text-xl font-bold text-teal-600 whitespace-pre-line"
        />
        <div className="mt-4 text-sm text-gray-600">
          Segmentation: <code className="bg-gray-100 px-2 py-1 rounded">line</code>
        </div>
      </div>
    </div>
  );
};

export { TextEffectExamples };