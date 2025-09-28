'use client';

import { TextEffectWrapper } from "@/components/TextEffectWrapper";
import { TextEffectExamples } from "@/components/TextEffectExamples";
import { ArrowRight, Sparkles, ShoppingCart, MessageCircle, Zap } from "lucide-react";
import { useState } from "react";

export default function MotionDemo() {
  const [activePreset, setActivePreset] = useState("fade");
  const [activePer, setActivePer] = useState("word");
  
  const presets = ["blur", "fade-in-blur", "scale", "fade", "slide"];
  const pers = ["char", "word", "line"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12 pt-8">
          <TextEffectWrapper 
            text="Motion Primitives Integration" 
            className="text-3xl md:text-5xl font-bold text-gray-800 mb-4"
            preset="fade"
          />
          <TextEffectWrapper 
            text="Animated UI components for WhatsApp Commerce Hub" 
            className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto"
            preset="slide"
            delay={0.3}
          />
        </header>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-800">Interactive Demo</h2>
            </div>
            <div className="space-y-6">
              <TextEffectWrapper 
                text="Welcome to WhatsApp Commerce Hub" 
                className="text-2xl font-bold text-blue-600"
                preset={activePreset}
                per={activePer}
              />
              <p className="text-gray-600">
                This text is animated using Motion Primitives with the <span className="font-medium">{activePreset}</span> preset 
                and <span className="font-medium">{activePer}</span> segmentation.
              </p>
              <button className="mt-4 flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shadow-md">
                Get Started <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-amber-500" />
              <h2 className="text-xl font-semibold text-gray-800">Customization</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Animation Preset</label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setActivePreset(preset)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition ${
                        activePreset === preset
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Segmentation</label>
                <div className="flex flex-wrap gap-2">
                  {pers.map((per) => (
                    <button
                      key={per}
                      onClick={() => setActivePer(per)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition ${
                        activePer === per
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {per}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Usage Example:</h3>
                <pre className="bg-gray-800 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                  {`<TextEffectWrapper 
  text="Your text here"
  preset="${activePreset}"
  per="${activePer}"
  className="your-classes"
/>`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg mb-12">
          <div className="flex items-center gap-3 mb-6">
            <MessageCircle className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold text-gray-800">Text Effect Examples</h2>
          </div>
          
          <TextEffectExamples />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg mb-12">
          <div className="flex items-center gap-3 mb-6">
            <ShoppingCart className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-semibold text-gray-800">WhatsApp Integration</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-blue-50">
              <TextEffectWrapper 
                text="Order Notifications" 
                className="text-lg font-bold text-blue-600 mb-2"
                preset="scale"
              />
              <p className="text-gray-600 text-sm">
                Animated confirmations for customer orders
              </p>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-amber-50">
              <TextEffectWrapper 
                text="Product Catalogs" 
                className="text-lg font-bold text-amber-600 mb-2"
                preset="blur"
              />
              <p className="text-gray-600 text-sm">
                Dynamic product showcase animations
              </p>
            </div>
            
            <div className="text-center p-4 rounded-lg bg-green-50">
              <TextEffectWrapper 
                text="Campaign Messages" 
                className="text-lg font-bold text-green-600 mb-2"
                preset="slide"
              />
              <p className="text-gray-600 text-sm">
                Eye-catching marketing campaign texts
              </p>
            </div>
          </div>
        </div>

        <footer className="text-center py-8 border-t border-gray-200">
          <TextEffectWrapper 
            text="Ready to enhance your WhatsApp Commerce experience?" 
            className="text-lg text-gray-700 mb-4"
            preset="fade-in-blur"
          />
          <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition shadow-lg">
            Explore Components
          </button>
        </footer>
      </div>
    </div>
  );
}