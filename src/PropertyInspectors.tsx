import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Dropdown option interface and CustomDropdown component (copied from App.tsx)
interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function CustomDropdown({ value, options, onChange, placeholder = 'Select...', disabled = false, className = '' }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedOption = options.find(option => option.value === value);
  const displayText = selectedOption?.label || placeholder;

  return (
    <div className={`custom-dropdown ${className}`}>
      <button
        className="custom-dropdown-button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        disabled={disabled}
      >
        {displayText}
        <ChevronDown size={12} style={{ marginLeft: 'auto' }} />
      </button>
      {isOpen && !disabled && (
        <div className="dropdown-options">
          {options.map(option => (
            <button
              key={option.value}
              className={`dropdown-option ${value === option.value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Property Inspector Components for PlayCanvas Runtime Editor
 * 
 * This module provides specialized UI components for displaying different data types
 * in the inspector, similar to Unity's property drawers. Supports:
 * 
 * - Boolean: Checkbox
 * - Number: Number input
 * - String: Text input  
 * - Vector3: Three X/Y/Z number inputs
 * - Vector2: Two X/Y number inputs
 * - Color: Color picker + RGBA inputs
 * - Enum: Dropdown selection
 * - Array: Expandable list with indexed items
 * - Object: Expandable nested properties
 * 
 * The PropertyRenderer automatically chooses the appropriate component based on
 * the data type and structure of the value.
 */

// Type definitions for property values
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Vector2 {
  x: number;
  y: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

// Base property props interface
interface BasePropertyProps {
  label: string;
  value: any;
  onChange?: (value: any) => void;
  readOnly?: boolean;
}

// Boolean property component (checkbox)
export function BooleanProperty({ label, value, onChange, readOnly = true }: BasePropertyProps) {
  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <div className="property-value">
        <label className="checkbox-container">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange?.(e.target.checked)}
            disabled={readOnly}
            style={{ display: 'none' }} // Hide the HTML checkbox
          />
          <span className="checkmark"></span>
        </label>
      </div>
    </div>
  );
}

// Number property component
export function NumberProperty({ label, value, onChange, readOnly = true }: BasePropertyProps) {
  const [inputValue, setInputValue] = useState(String(value || 0));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      onChange?.(numValue);
    }
  };

  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <div className="property-value">
        <input
          type="number"
          value={inputValue}
          onChange={handleChange}
          disabled={readOnly}
          className="number-input"
          step="0.01"
        />
      </div>
    </div>
  );
}

// String property component
export function StringProperty({ label, value, onChange, readOnly = true }: BasePropertyProps) {
  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <div className="property-value">
        <input
          type="text"
          value={String(value || '')}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={readOnly}
          className="text-input"
        />
      </div>
    </div>
  );
}

// Vector3 property component (like position/rotation/scale)
export function Vector3Property({ label, value, onChange, readOnly = true }: BasePropertyProps) {
  const vec = value as Vector3 || { x: 0, y: 0, z: 0 };

  const handleAxisChange = (axis: 'x' | 'y' | 'z', newValue: number) => {
    if (!onChange) return;
    onChange({ ...vec, [axis]: newValue });
  };

  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <div className="property-value">
        <div className="vector3-input">
          <div className="vector-axis">
            <span className="axis-label">X</span>
            <input
              type="number"
              value={vec.x.toFixed(3)}
              onChange={(e) => handleAxisChange('x', parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              className="vector-input"
              step="0.001"
            />
          </div>
          <div className="vector-axis">
            <span className="axis-label">Y</span>
            <input
              type="number"
              value={vec.y.toFixed(3)}
              onChange={(e) => handleAxisChange('y', parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              className="vector-input"
              step="0.001"
            />
          </div>
          <div className="vector-axis">
            <span className="axis-label">Z</span>
            <input
              type="number"
              value={vec.z.toFixed(3)}
              onChange={(e) => handleAxisChange('z', parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              className="vector-input"
              step="0.001"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Vector2 property component
export function Vector2Property({ label, value, onChange, readOnly = true }: BasePropertyProps) {
  const vec = value as Vector2 || { x: 0, y: 0 };

  const handleAxisChange = (axis: 'x' | 'y', newValue: number) => {
    if (!onChange) return;
    onChange({ ...vec, [axis]: newValue });
  };

  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <div className="property-value">
        <div className="vector2-input">
          <div className="vector-axis">
            <span className="axis-label">X</span>
            <input
              type="number"
              value={vec.x.toFixed(3)}
              onChange={(e) => handleAxisChange('x', parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              className="vector-input"
              step="0.001"
            />
          </div>
          <div className="vector-axis">
            <span className="axis-label">Y</span>
            <input
              type="number"
              value={vec.y.toFixed(3)}
              onChange={(e) => handleAxisChange('y', parseFloat(e.target.value) || 0)}
              disabled={readOnly}
              className="vector-input"
              step="0.001"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Color property component
export function ColorProperty({ label, value, onChange, readOnly = true }: BasePropertyProps) {
  const color = value as Color || { r: 1, g: 1, b: 1, a: 1 };

  const handleColorChange = (channel: 'r' | 'g' | 'b' | 'a', newValue: number) => {
    if (!onChange) return;
    onChange({ ...color, [channel]: Math.max(0, Math.min(1, newValue)) });
  };

  // Convert to hex for color picker
  const toHex = (c: Color) => {
    const r = Math.round(c.r * 255).toString(16).padStart(2, '0');
    const g = Math.round(c.g * 255).toString(16).padStart(2, '0');
    const b = Math.round(c.b * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };

  const fromHex = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { ...color, r, g, b };
  };

  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <div className="property-value">
        <div className="color-input">
          <div className="color-preview" style={{ backgroundColor: toHex(color) }}>
            <input
              type="color"
              value={toHex(color)}
              onChange={(e) => onChange?.(fromHex(e.target.value))}
              disabled={readOnly}
              className="color-picker"
            />
          </div>
          <div className="color-values">
            <div className="color-channel">
              <span>R</span>
              <input
                type="number"
                value={color.r.toFixed(3)}
                onChange={(e) => handleColorChange('r', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
                className="color-channel-input"
                min="0"
                max="1"
                step="0.01"
              />
            </div>
            <div className="color-channel">
              <span>G</span>
              <input
                type="number"
                value={color.g.toFixed(3)}
                onChange={(e) => handleColorChange('g', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
                className="color-channel-input"
                min="0"
                max="1"
                step="0.01"
              />
            </div>
            <div className="color-channel">
              <span>B</span>
              <input
                type="number"
                value={color.b.toFixed(3)}
                onChange={(e) => handleColorChange('b', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
                className="color-channel-input"
                min="0"
                max="1"
                step="0.01"
              />
            </div>
            {color.a !== undefined && (
              <div className="color-channel">
                <span>A</span>
                <input
                  type="number"
                  value={color.a.toFixed(3)}
                  onChange={(e) => handleColorChange('a', parseFloat(e.target.value) || 0)}
                  disabled={readOnly}
                  className="color-channel-input"
                  min="0"
                  max="1"
                  step="0.01"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Enum property component (dropdown)
interface EnumPropertyProps extends BasePropertyProps {
  options: Array<{ value: any; label: string }>;
}

export function EnumProperty({ label, value, onChange, options, readOnly = true }: EnumPropertyProps) {
  // Convert options to DropdownOption format
  const dropdownOptions: DropdownOption[] = options.map(opt => ({
    value: String(opt.value),
    label: opt.label
  }));

  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <div className="property-value">
        <CustomDropdown
          value={String(value)}
          options={dropdownOptions}
          onChange={(newValue) => {
            const option = options.find(opt => String(opt.value) === newValue);
            onChange?.(option?.value);
          }}
          disabled={readOnly}
          className="enum-dropdown"
        />
      </div>
    </div>
  );
}

// Array property component
export function ArrayProperty({ label, value, onChange, readOnly = true }: BasePropertyProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const array = Array.isArray(value) ? value : [];

  return (
    <div className="property-row">
      <div className="property-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="expand-icon">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="property-label">{label}</span>
        <span className="array-length">({array.length})</span>
      </div>
      {isExpanded && (
        <div className="array-content">
          {array.map((item, index) => (
            <div key={index} className="array-item">
              <span className="array-index">[{index}]</span>
              <PropertyRenderer
                label=""
                value={item}
                onChange={readOnly ? undefined : (newValue) => {
                  const newArray = [...array];
                  newArray[index] = newValue;
                  onChange?.(newArray);
                }}
                readOnly={readOnly}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Object property component
export function ObjectProperty({ label, value, onChange, readOnly = true }: BasePropertyProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const obj = value && typeof value === 'object' ? value : {};

  return (
    <div className="property-row">
      <div className="property-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="expand-icon">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="property-label">{label}</span>
      </div>
      {isExpanded && (
        <div className="object-content">
          {Object.entries(obj).map(([key, val]) => (
            <PropertyRenderer
              key={key}
              label={key}
              value={val}
              onChange={readOnly ? undefined : (newValue) => {
                onChange?.({ ...obj, [key]: newValue });
              }}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Main property renderer that chooses the appropriate component
interface PropertyRendererProps extends BasePropertyProps {
  // Additional props for specific types
  enumOptions?: Array<{ value: any; label: string }>;
}

export function PropertyRenderer({ label, value, onChange, readOnly = true, enumOptions }: PropertyRendererProps) {
  // Determine the type of property and render accordingly
  if (value === null || value === undefined) {
    return (
      <div className="property-row">
        <span className="property-label">{label}</span>
        <span className="property-value null-value">null</span>
      </div>
    );
  }

  // Check for specific object types first
  if (value && typeof value === 'object') {
    // Vector3 detection
    if ('x' in value && 'y' in value && 'z' in value && Object.keys(value).length <= 3) {
      return <Vector3Property label={label} value={value} onChange={onChange} readOnly={readOnly} />;
    }
    
    // Vector2 detection
    if ('x' in value && 'y' in value && Object.keys(value).length === 2) {
      return <Vector2Property label={label} value={value} onChange={onChange} readOnly={readOnly} />;
    }
    
    // Color detection (r, g, b, and optionally a)
    if ('r' in value && 'g' in value && 'b' in value) {
      return <ColorProperty label={label} value={value} onChange={onChange} readOnly={readOnly} />;
    }
    
    // Array detection
    if (Array.isArray(value)) {
      return <ArrayProperty label={label} value={value} onChange={onChange} readOnly={readOnly} />;
    }
    
    // Generic object
    return <ObjectProperty label={label} value={value} onChange={onChange} readOnly={readOnly} />;
  }

  // Primitive types
  if (typeof value === 'boolean') {
    return <BooleanProperty label={label} value={value} onChange={onChange} readOnly={readOnly} />;
  }

  if (typeof value === 'number') {
    // Check if we have enum options
    if (enumOptions) {
      return <EnumProperty label={label} value={value} onChange={onChange} options={enumOptions} readOnly={readOnly} />;
    }
    return <NumberProperty label={label} value={value} onChange={onChange} readOnly={readOnly} />;
  }

  if (typeof value === 'string') {
    // Check if we have enum options
    if (enumOptions) {
      return <EnumProperty label={label} value={value} onChange={onChange} options={enumOptions} readOnly={readOnly} />;
    }
    return <StringProperty label={label} value={value} onChange={onChange} readOnly={readOnly} />;
  }

  // Fallback for unknown types
  return (
    <div className="property-row">
      <span className="property-label">{label}</span>
      <span className="property-value unknown-type">
        {String(value)} ({typeof value})
      </span>
    </div>
  );
} 