'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast, Toaster } from 'sonner'
import { TemplatePanel } from '@/components/dashboard/TemplatePanel'
import { 
  Plus,
  Search,
  Phone,
  User,
  Package,
  ShoppingCart,
  Send,
  RefreshCw
} from 'lucide-react'

export default function SendCatalogPage() {
  const [contacts, setContacts] = useState([])
  const [products, setProducts] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [recipient, setRecipient] = useState('')
  const [newContact, setNewContact] = useState({ name: '', phone: '' })
  const [showNewContactDialog, setShowNewContactDialog] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState({
    contacts: false,
    products: false,
    send: false
  })

  // Load data on mount
  useEffect(() => {
    loadContacts()
    loadProducts()
  }, [])

  const loadContacts = async () => {
    try {
      setLoading(prev => ({ ...prev, contacts: true }))
      const response = await fetch('/api/chats')
      if (response.ok) {
        const data = await response.json()
        // Transform the chat data to match our contact structure
        const contactData = data.map(chat => ({
          id: chat.id,
          name: chat.name || `Customer ${chat.phone}`,
          phone: chat.phone
        }))
        setContacts(contactData)
      } else {
        toast.error('Failed to load contacts')
      }
    } catch (error) {
      console.error('Failed to load contacts:', error)
      toast.error('Failed to load contacts')
    } finally {
      setLoading(prev => ({ ...prev, contacts: false }))
    }
  }

  const loadProducts = async () => {
    try {
      setLoading(prev => ({ ...prev, products: true }))
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      } else {
        toast.error('Failed to load products')
      }
    } catch (error) {
      console.error('Failed to load products:', error)
      toast.error('Failed to load products')
    } finally {
      setLoading(prev => ({ ...prev, products: false }))
    }
  }

  const handleCreateContact = async () => {
    if (!newContact.name || !newContact.phone) {
      toast.error('Please enter both name and phone number')
      return
    }

    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContact.name,
          phone: newContact.phone
        })
      })

      if (response.ok) {
        const contact = await response.json()
        setContacts(prev => [{
          id: contact.id,
          name: contact.name,
          phone: contact.phone
        }, ...prev])
        setNewContact({ name: '', phone: '' })
        setShowNewContactDialog(false)
        toast.success('Contact created successfully')
      } else {
        toast.error('Failed to create contact')
      }
    } catch (error) {
      console.error('Failed to create contact:', error)
      toast.error('Failed to create contact')
    }
  }

  const handleSelectContact = (contact) => {
    // Instead of replacing the recipient, we'll add to the list if not already there
    const phoneNumbers = recipient.split(',').map(num => num.trim()).filter(num => num)
    if (!phoneNumbers.includes(contact.phone)) {
      const newRecipientList = recipient ? `${recipient}, ${contact.phone}` : contact.phone
      setRecipient(newRecipientList)
    }
  }

  const handleSelectProduct = (productId) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(prev => prev.filter(id => id !== productId))
    } else {
      setSelectedProducts(prev => [...prev, productId])
    }
  }

  const handleSendCatalog = async (templateName = null) => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    if (!recipient) {
      toast.error('Please select a recipient or enter a phone number')
      return
    }

    try {
      setLoading(prev => ({ ...prev, send: true }))
      
      // Split the recipient string into an array of phone numbers
      const phoneNumbers = recipient.split(',').map(num => num.trim()).filter(num => num)
      
      // Send to each recipient
      const results = []
      for (const phoneNumber of phoneNumbers) {
        try {
          const response = await fetch('/api/send-catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              products: selectedProducts,
              recipient: phoneNumber,
              templateName: templateName
            })
          })
          
          if (response.ok) {
            results.push({ success: true, phoneNumber })
          } else {
            const error = await response.json()
            results.push({ success: false, phoneNumber, error: error.error || 'Failed to send catalog' })
          }
        } catch (error) {
          console.error(`Failed to send catalog to ${phoneNumber}:`, error)
          results.push({ success: false, phoneNumber, error: 'Failed to send catalog' })
        }
      }
      
      // Show results to user
      const successfulSends = results.filter(r => r.success).length
      const failedSends = results.filter(r => !r.success).length
      
      if (successfulSends > 0) {
        toast.success(
          templateName ? 
            `Catalog sent to ${successfulSends} recipient${successfulSends !== 1 ? 's' : ''} with template "${templateName}"!` : 
            `Catalog sent to ${successfulSends} recipient${successfulSends !== 1 ? 's' : ''} as text message!`
        )
      }
      
      if (failedSends > 0) {
        toast.error(`Failed to send catalog to ${failedSends} recipient${failedSends !== 1 ? 's' : ''}`)
        // Log the errors for debugging
        results.filter(r => !r.success).forEach(r => {
          console.error(`Failed to send to ${r.phoneNumber}:`, r.error)
        })
      }
      
      // Clear selection if all were successful
      if (successfulSends > 0 && failedSends === 0) {
        setSelectedProducts([])
      }
    } catch (error) {
      console.error('Failed to send catalog:', error)
      toast.error('Failed to send catalog')
    } finally {
      setLoading(prev => ({ ...prev, send: false }))
    }
  }

  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  )

  return (
    <div className="space-y-6">
      <Toaster />
      
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Send Catalog</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select contacts, products, and send your catalog via WhatsApp
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Contact List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Contacts
                </CardTitle>
                <Dialog open={showNewContactDialog} onOpenChange={setShowNewContactDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Contact
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Contact</DialogTitle>
                      <DialogDescription>
                        Add a new contact to send catalogs to
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="contact-name">Name</Label>
                        <Input
                          id="contact-name"
                          placeholder="John Doe"
                          value={newContact.name}
                          onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-phone">Phone Number</Label>
                        <Input
                          id="contact-phone"
                          placeholder="+1234567890"
                          value={newContact.phone}
                          onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <Button onClick={handleCreateContact} disabled={!newContact.name || !newContact.phone}>
                        Create Contact
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>
                Select contacts to send the catalog to (multiple selection supported)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search contacts..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {loading.contacts ? (
                    <div className="text-center py-4">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">Loading contacts...</p>
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="text-center py-8">
                      <User className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-sm text-gray-500">No contacts found</p>
                      <Button 
                        variant="ghost" 
                        className="mt-2"
                        onClick={() => setShowNewContactDialog(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add your first contact
                      </Button>
                    </div>
                  ) : (
                    filteredContacts.map((contact) => {
                      // Check if this contact is selected
                      const phoneNumbers = recipient.split(',').map(num => num.trim()).filter(num => num)
                      const isSelected = phoneNumbers.includes(contact.phone)
                      
                      return (
                        <div 
                          key={contact.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => handleSelectContact(contact)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium">{contact.name}</h3>
                              <p className="text-sm text-gray-500 flex items-center">
                                <Phone className="w-3 h-3 mr-1" />
                                {contact.phone}
                              </p>
                            </div>
                            {isSelected && (
                              <Badge variant="default" className="bg-blue-500">
                                Selected
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center Column - Product Table */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Products
              </CardTitle>
              <CardDescription>
                Select products to include in the catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Selected: {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadProducts}
                    disabled={loading.products}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading.products ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {loading.products ? (
                    <div className="text-center py-4">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">Loading products...</p>
                    </div>
                  ) : products.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-sm text-gray-500">No products available</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Connect Shopify to load products
                      </p>
                    </div>
                  ) : (
                    products.map((product) => (
                      <div 
                        key={product.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedProducts.includes(product.id) 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => handleSelectProduct(product.id)}
                      >
                        <div className="flex items-start">
                          {product.image ? (
                            <img 
                              src={product.image} 
                              alt={product.title}
                              className="w-12 h-12 object-cover rounded mr-3"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded mr-3 flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-500" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium text-sm">{product.title}</h3>
                              <Badge variant="outline">${product.price}</Badge>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {product.description || 'No description'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Template Panel */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Send className="w-5 h-5 mr-2" />
                Send Options
              </CardTitle>
              <CardDescription>
                Send catalog with approved templates or as text
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="recipient">Recipient Phone Numbers</Label>
                <Textarea
                  id="recipient"
                  placeholder="+1234567890, +1987654321"
                  className="mt-1"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {recipient ? 'Ready to send' : 'Select contacts or enter phone numbers (comma-separated)'}
                </p>
              </div>
              
              <TemplatePanel 
                selectedProducts={selectedProducts}
                recipient={recipient}
                onSendWithTemplate={handleSendCatalog}
              />
              
              <div className="pt-4 border-t">
                <Button 
                  onClick={() => handleSendCatalog()}
                  disabled={loading.send || selectedProducts.length === 0 || !recipient}
                  className="w-full"
                >
                  {loading.send ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send as Text Message
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Sends catalog as a text message to all recipients
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}