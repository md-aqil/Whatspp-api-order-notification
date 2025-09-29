'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { RefreshCw, Sparkles, Info, AlertCircle, ExternalLink } from 'lucide-react'

export function TemplatePanel({ selectedProducts, recipient, onSendWithTemplate }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [manualTemplateName, setManualTemplateName] = useState('')
  const [apiError, setApiError] = useState(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      setApiError(null)
      const response = await fetch('/api/whatsapp-templates')
      if (response.ok) {
        const data = await response.json()
        // Ensure we're setting an array of templates
        setTemplates(Array.isArray(data) ? data : [])
      } else {
        const error = await response.json()
        // Set empty array to show manual entry option
        setTemplates([])
        setApiError(error)
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      // Set empty array to show manual entry option
      setTemplates([])
      setApiError({ error: 'Connection error', guidance: 'Unable to connect to the templates service.' })
    } finally {
      setLoading(false)
    }
  }

  const handleSendWithTemplate = () => {
    const templateName = selectedTemplate?.name || manualTemplateName
    
    if (!templateName) {
      toast.error('Please select a template or enter a template name')
      return
    }

    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    if (!recipient) {
      toast.error('Please enter recipient phone number(s)')
      return
    }

    onSendWithTemplate(templateName)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
              Approved Templates
            </CardTitle>
            <CardDescription>
              Select a template to send with your catalog
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadTemplates}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(!Array.isArray(templates) || templates.length === 0) ? (
          <div className="space-y-4">
            <div className="text-center py-4">
              <Sparkles className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-muted-foreground">
                {loading ? 'Loading templates...' : 'No approved templates found'}
              </p>
              <div className="mt-2 text-sm text-muted-foreground flex items-center justify-center">
                <Info className="w-4 h-4 mr-1" />
                <span>Templates must be created in your Meta Business account</span>
              </div>
            </div>
            
            {apiError && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-yellow-800">Template API Issue</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      {apiError.error || 'Unable to fetch templates from WhatsApp API'}
                    </p>
                    {apiError.guidance && (
                      <p className="text-sm text-yellow-700 mt-1">
                        {apiError.guidance}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input
                placeholder="Enter template name (e.g., order_confirmation)"
                value={manualTemplateName}
                onChange={(e) => setManualTemplateName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the exact name of your approved WhatsApp template
              </p>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Need to create a template?</strong></p>
              <p>1. Go to Facebook Business Manager</p>
              <p>2. Navigate to WhatsApp &gt; Templates</p>
              <p>3. Create a template named "order_confirmation"</p>
              <p>4. Submit for approval (1-2 business days)</p>
              <p className="mt-2">
                <a 
                  href="https://business.facebook.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline inline-flex items-center"
                >
                  Go to Business Manager <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              </p>
            </div>
            
            <Separator />
            
            <Button 
              onClick={handleSendWithTemplate}
              disabled={loading || (!selectedTemplate && !manualTemplateName) || selectedProducts.length === 0 || !recipient}
              className="w-full"
            >
              {loading ? 'Sending...' : `Send with Template`}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3">
              {templates.map((template) => (
                <div 
                  key={template.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{template.name}</h3>
                    <Badge variant="secondary">{template.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {template.components?.find(c => c.type === 'BODY')?.text || 'No preview available'}
                  </p>
                  <div className="flex items-center mt-2">
                    <Badge variant="outline" className="text-xs">
                      {template.language}
                    </Badge>
                    <Badge variant="default" className="ml-2 text-xs bg-green-500">
                      {template.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            
            <Separator />
            
            <Button 
              onClick={handleSendWithTemplate}
              disabled={loading || !selectedTemplate || selectedProducts.length === 0 || !recipient}
              className="w-full"
            >
              {loading ? 'Sending...' : `Send with "${selectedTemplate?.name || 'Template'}"`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}