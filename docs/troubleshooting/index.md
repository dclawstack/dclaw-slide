# Troubleshooting

Common issues and solutions for DClaw Slide.

## Quick Diagnostics

```bash
# Check app pods
kubectl get pods -n dclaw-slide

# Check logs
kubectl logs -n dclaw-slide deployment/dclaw-slide-backend

# Check database
kubectl get clusters -n dclaw-slide
```

## Sections

- [Common Issues](./common-issues)
- [FAQ](./faq)
