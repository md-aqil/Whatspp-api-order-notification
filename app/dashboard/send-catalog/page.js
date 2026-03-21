'use client'

import { useEffect, useState } from 'react'
import { toast, Toaster } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TemplatePanel } from '@/components/dashboard/TemplatePanel'
import { Package, Phone, Plus, RefreshCw, Search, User } from 'lucide-react'

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

  useEffect(() => {
    loadContacts()
    loadProducts()
  }, [])

  async function loadContacts() {
    try {
      setLoading((current) => ({ ...current, contacts: true }))
      const response = await fetch('/api/chats')
      if (!response.ok) throw new Error('Failed to load contacts')
      const data = await response.json()
      setContacts((Array.isArray(data) ? data : []).map((chat) => ({
        id: chat.id,
        name: chat.name || `Customer ${chat.phone}`,
        phone: chat.phone
      })))
    } catch (error) {
      console.error('Failed to load contacts:', error)
      toast.error('Failed to load contacts')
    } finally {
      setLoading((current) => ({ ...current, contacts: false }))
    }
  }

  async function loadProducts() {
    try {
      setLoading((current) => ({ ...current, products: true }))
      const response = await fetch('/api/products')
      if (!response.ok) throw new Error('Failed to load products')
      const data = await response.json()
      setProducts(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load products:', error)
      setProducts([])
      toast.error('Failed to load products')
    } finally {
      setLoading((current) => ({ ...current, products: false }))
    }
  }

  async function handleCreateContact() {
    if (!newContact.name || !newContact.phone) {
      toast.error('Please enter both name and phone number')
      return
    }

    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      })
      if (!response.ok) throw new Error('Failed to create contact')
      const contact = await response.json()
      setContacts((current) => [
        { id: contact.id, name: contact.name, phone: contact.phone },
        ...current
      ])
      setNewContact({ name: '', phone: '' })
      setShowNewContactDialog(false)
      toast.success('Contact created successfully')
    } catch (error) {
      console.error('Failed to create contact:', error)
      toast.error('Failed to create contact')
    }
  }

  function handleSelectContact(contact) {
    const phoneNumbers = recipient.split(',').map((value) => value.trim()).filter(Boolean)
    if (!phoneNumbers.includes(contact.phone)) {
      setRecipient(recipient ? `${recipient}, ${contact.phone}` : contact.phone)
    }
  }

  function handleSelectProduct(productId) {
    setSelectedProducts((current) => (
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    ))
  }

  async function handleSendCatalog(template = null) {
    if (!recipient) {
      toast.error('Please select a recipient or enter a phone number')
      return
    }

    try {
      setLoading((current) => ({ ...current, send: true }))
      const phoneNumbers = recipient.split(',').map((value) => value.trim()).filter(Boolean)
      const results = []

      for (const phoneNumber of phoneNumbers) {
        try {
          const response = await fetch('/api/send-catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              products: selectedProducts,
              recipient: phoneNumber,
              templateName: template?.name || null,
              templateLanguage: template?.language || null,
              templateComponents: template?.components || null,
              templateVariables: template?.variables || [],
              templateHeaderImageUrl: template?.headerImageUrl || ''
            })
          })

          if (!response.ok) {
            const error = await response.json()
            results.push({ success: false, phoneNumber, error: error.error || 'Failed to send catalog' })
          } else {
            results.push({ success: true, phoneNumber })
          }
        } catch (error) {
          console.error(`Failed to send catalog to ${phoneNumber}:`, error)
          results.push({ success: false, phoneNumber, error: 'Failed to send catalog' })
        }
      }

      const successfulSends = results.filter((item) => item.success).length
      const failedSends = results.filter((item) => !item.success).length

      if (successfulSends > 0) {
        toast.success(
          template?.name
            ? `Catalog sent to ${successfulSends} recipient${successfulSends !== 1 ? 's' : ''} with template "${template.name}"`
            : `Catalog link sent to ${successfulSends} recipient${successfulSends !== 1 ? 's' : ''}`
        )
      }

      if (failedSends > 0) {
        toast.error(`Failed to send to ${failedSends} recipient${failedSends !== 1 ? 's' : ''}`)
        results.filter((item) => !item.success).forEach((item) => {
          console.error(`Failed to send to ${item.phoneNumber}:`, item.error)
        })
      }
    } catch (error) {
      console.error('Failed to send catalog:', error)
      toast.error('Failed to send catalog')
    } finally {
      setLoading((current) => ({ ...current, send: false }))
    }
  }

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  )

  const selectedRecipients = recipient.split(',').map((value) => value.trim()).filter(Boolean)

  return (
    <div className="space-y-6">
      <Toaster />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Send Catalog</h1>
        <p className="mt-1 text-sm text-gray-500">
          Send catalog templates with optional product context, image headers, and multi-recipient support.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Contacts
              </CardTitle>
              <Dialog open={showNewContactDialog} onOpenChange={setShowNewContactDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                    <DialogDescription>Add a new contact to send catalogs to</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="contact-name">Name</Label>
                      <Input
                        id="contact-name"
                        placeholder="John Doe"
                        value={newContact.name}
                        onChange={(event) => setNewContact((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact-phone">Phone Number</Label>
                      <Input
                        id="contact-phone"
                        placeholder="+1234567890"
                        value={newContact.phone}
                        onChange={(event) => setNewContact((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </div>
                    <Button onClick={handleCreateContact} disabled={!newContact.name || !newContact.phone}>
                      Create Contact
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <CardDescription>Choose one or more recipients for this send.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search contacts..."
                className="pl-10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="max-h-[34rem] space-y-2 overflow-y-auto">
              {loading.contacts ? (
                <div className="py-4 text-center">
                  <RefreshCw className="mx-auto h-6 w-6 animate-spin" />
                  <p className="mt-2 text-sm text-gray-500">Loading contacts...</p>
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="py-8 text-center">
                  <User className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="text-sm text-gray-500">No contacts found</p>
                </div>
              ) : (
                filteredContacts.map((contact) => {
                  const isSelected = selectedRecipients.includes(contact.phone)
                  return (
                    <div
                      key={contact.id}
                      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => handleSelectContact(contact)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{contact.name}</h3>
                          <p className="mt-1 flex items-center text-sm text-gray-500">
                            <Phone className="mr-1 h-3 w-3" />
                            {contact.phone}
                          </p>
                        </div>
                        {isSelected && <Badge className="bg-blue-500">Selected</Badge>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="mr-2 h-5 w-5" />
              Optional product context
            </CardTitle>
            <CardDescription>
              Only needed for placeholders like product name, product price, product link, or product names.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Selected: {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''}
              </p>
              <Button variant="outline" size="sm" onClick={loadProducts} disabled={loading.products}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading.products ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            <div className="max-h-[34rem] space-y-3 overflow-y-auto">
              {loading.products ? (
                <div className="py-4 text-center">
                  <RefreshCw className="mx-auto h-6 w-6 animate-spin" />
                  <p className="mt-2 text-sm text-gray-500">Loading products...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="py-8 text-center">
                  <Package className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="text-sm text-gray-500">No products available</p>
                </div>
              ) : (
                products.map((product) => (
                  <div
                    key={product.id}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      selectedProducts.includes(product.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelectProduct(product.id)}
                  >
                    <div className="flex items-start gap-3">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image} alt={product.title} className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200">
                          <Package className="h-5 w-5 text-gray-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="line-clamp-2 text-sm font-medium">{product.title}</h3>
                          <Badge variant="outline">${product.price}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Used when the selected template needs product-aware values.
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Send Options</CardTitle>
            <CardDescription>
              Use an approved template with optional image header and variable mapping.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <Label htmlFor="recipient">Recipient Phone Numbers</Label>
              <Textarea
                id="recipient"
                placeholder="+1234567890, +1987654321"
                className="mt-2 bg-white"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                rows={3}
              />
              <p className="mt-2 text-xs text-gray-500">
                {recipient ? 'Ready to send' : 'Select contacts or enter phone numbers (comma-separated)'}
              </p>
            </div>

            <TemplatePanel
              selectedProducts={selectedProducts}
              recipient={recipient}
              onSendWithTemplate={handleSendCatalog}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
