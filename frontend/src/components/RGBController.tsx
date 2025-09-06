import React, { useState } from 'react';

interface RGBControllerProps {
  onColorChange: (colorData: any) => void;
  currentColor?: string;
  isLoading?: boolean;
}

const RGBController: React.FC<RGBControllerProps> = ({ 
  onColorChange, 
  currentColor = '#000000',
  isLoading = false 
}) => {
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [controlMode, setControlMode] = useState<'preset' | 'custom'>('preset');

  const presetColors = [
    { name: 'Rojo', color: '#FF0000', value: 'rojo' },
    { name: 'Verde', color: '#00FF00', value: 'verde' },
    { name: 'Azul', color: '#0000FF', value: 'azul' }
  ];

  const handlePresetColor = (colorData: any) => {
    setSelectedColor(colorData.color);
    onColorChange({ color: colorData.value });
  };

  const handleCustomColor = (hexColor: string) => {
    setSelectedColor(hexColor);
    onColorChange({ hex: hexColor });
  };

  const handleTurnOff = () => {
    setSelectedColor('#000000');
    onColorChange({ color: 'off' });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-800">Control LED RGB</h2>
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-full border-2 border-slate-300 shadow-inner"
            style={{ backgroundColor: selectedColor }}
          ></div>
          <span className="text-sm text-slate-600">{selectedColor}</span>
        </div>
      </div>

      {/* Selector de modo */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'preset', label: 'Colores' },
          { key: 'custom', label: 'Personalizado' }
        ].map((mode) => (
          <button
            key={mode.key}
            onClick={() => setControlMode(mode.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              controlMode === mode.key
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Modo: Colores predefinidos */}
      {controlMode === 'preset' && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-700">Colores predefinidos</h3>
          <div className="grid grid-cols-3 gap-3">
            {presetColors.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetColor(preset)}
                disabled={isLoading}
                className="flex flex-col items-center gap-2 p-3 rounded-lg border-2 border-transparent hover:border-slate-300 transition-all disabled:opacity-50"
                title={preset.name}
              >
                <div 
                  className="w-10 h-10 rounded-full shadow-md border border-slate-200"
                  style={{ backgroundColor: preset.color }}
                ></div>
                <span className="text-xs text-slate-600">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modo: Color personalizado */}
      {controlMode === 'custom' && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-700">Selector de color</h3>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => handleCustomColor(e.target.value)}
              className="w-16 h-16 rounded-lg border border-slate-300 cursor-pointer"
              disabled={isLoading}
            />
            <div className="flex-1">
              <input
                type="text"
                value={selectedColor}
                onChange={(e) => handleCustomColor(e.target.value)}
                placeholder="#FF0000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500 mt-1">Ingresa un código hexadecimal</p>
            </div>
          </div>
        </div>
      )}

      {/* Botones de control */}
      <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
        <button
          onClick={handleTurnOff}
          disabled={isLoading}
          className="flex-1 bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Apagando...' : 'Apagar'}
        </button>
        
        {controlMode === 'custom' && (
          <button
            onClick={() => handleCustomColor(selectedColor)}
            disabled={isLoading}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Aplicando...' : 'Aplicar'}
          </button>
        )}
      </div>
      
      {isLoading && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Enviando comando...
        </div>
      )}
    </div>
  );
};

export default RGBController;