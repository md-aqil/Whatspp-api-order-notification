'use client';

import { TextEffectWrapper } from "@/components/TextEffectWrapper";
import { ArrowRight, Sparkles, ShoppingCart, MessageCircle } from "lucide-react";
import { useState } from "react";

export default function TextEffectDemo() {
  const [activePreset, setActivePreset] = useState("fade");
  const [activePer, setActivePer] = useState("word");
  
  const presets = ["blur", "fade-in-blur", "scale", "fade", "slide"];
  const pers = ["char", "word", "line"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-16 pt-8">
          <TextEffectWrapper 
            text="Motion Primitives Demo" 
            className="text-4xl md:text-5xl font-bold text-gray-800 mb-4"
            preset="fade"
          />
          <TextEffectWrapper 
            text="Animated text effects with Tailwind CSS and Motion Primitives" 
            className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto"
            preset="slide"
            delay={0.3}
          />
        </header>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
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
                This text is animated using Motion Primitives with the {activePreset} preset 
                and {activePer} segmentation.
              </p>
              <button className="mt-4 flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shadow-md">
                Get Started <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-semibold text-gray-800">Customization</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Preset</label>
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
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {per}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg mb-16">
          <div className="flex items-center gap-3 mb-6">
            <ShoppingCart className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold text-gray-800">Example Use Cases</h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <TextEffectWrapper 
                text="Product Launch" 
                className="text-xl font-bold text-purple-600 mb-2"
                preset="scale"
              />
              <p className="text-gray-600 text-sm">
                Animate headlines for new product announcements
              </p>
            </div>
            
            <div className="text-center">
              <TextEffectWrapper 
                text="Special Offers" 
                className="text-xl font-bold text-amber-600 mb-2"
                preset="blur"
              />
              <p className="text-gray-600 text-sm">
                Highlight promotional content with blur effects
              </p>
            </div>
            
            <div className="text-center">
              <TextEffectWrapper 
                text="Customer Reviews" 
                className="text-xl font-bold text-emerald-600 mb-2"
                preset="slide"
              />
              <p className="text-gray-600 text-sm">
                Slide in testimonials and user feedback
              </p>
            </div>
          </div>
        </div>

        <footer className="text-center py-8 border-t border-gray-200">
          <TextEffectWrapper 
            text="Ready to enhance your UI with animations?" 
            className="text-lg text-gray-700 mb-4"
            preset="fade-in-blur"
          />
          <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition shadow-lg">
            Get Started Now
          </button>
        </footer>
      </div>
    </div>
  );
}