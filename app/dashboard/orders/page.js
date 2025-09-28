'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  Clock, 
  XCircle, 
  Package,
  Truck,
  DollarSign
} from 'lucide-react'

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/orders')
        if (response.ok) {
          const data = await response.json()
          // Transform the data to match the expected format
          const transformedOrders = data.map(order => ({
            id: order.orderNumber || order.id,
            customer: order.customerName || 'Unknown Customer',
            phone: order.customerPhone || 'N/A',
            total: parseFloat(order.total) || 0,
            status: order.status || 'pending',
            date: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
            items: order.lineItems ? order.lineItems.length : 0
          }))
          setOrders(transformedOrders)
        } else {
          throw new Error('Failed to load orders')
        }
      } catch (error) {
        console.error('Failed to load orders:', error)
        // Fallback to mock data if API fails
        const mockOrders = [
          {
            id: '1001',
            customer: 'John Doe',
            phone: '+1234567890',
            total: 125.99,
            status: 'fulfilled',
            date: '2023-06-15',
            items: 3
          },
          {
            id: '1002',
            customer: 'Jane Smith',
            phone: '+1234567891',
            total: 89.50,
            status: 'shipped',
            date: '2023-06-14',
            items: 2
          },
          {
            id: '1003',
            customer: 'Robert Johnson',
            phone: '+1234567892',
            total: 245.75,
            status: 'pending',
            date: '2023-06-14',
            items: 5
          },
          {
            id: '1004',
            customer: 'Emily Davis',
            phone: '+1234567893',
            total: 56.25,
            status: 'cancelled',
            date: '2023-06-13',
            items: 1
          },
          {
            id: '1005',
            customer: 'Michael Wilson',
            phone: '+1234567894',
            total: 199.99,
            status: 'refunded',
            date: '2023-06-12',
            items: 2
          }
        ]
        setOrders(mockOrders)
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'fulfilled':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'shipped':
        return <Truck className="h-4 w-4 text-blue-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'refunded':
        return <DollarSign className="h-4 w-4 text-purple-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'fulfilled':
        return <Badge className="bg-green-100 text-green-800">Fulfilled</Badge>
      case 'shipped':
        return <Badge className="bg-blue-100 text-blue-800">Shipped</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>
      case 'refunded':
        return <Badge className="bg-purple-100 text-purple-800">Refunded</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading orders...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage and track your customer orders
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
          <CardDescription>
            Overview of all customer orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.id}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{order.phone}</TableCell>
                  <TableCell>{order.date}</TableCell>
                  <TableCell>{order.items}</TableCell>
                  <TableCell>${order.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {getStatusIcon(order.status)}
                      <span className="ml-2">{getStatusBadge(order.status)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}