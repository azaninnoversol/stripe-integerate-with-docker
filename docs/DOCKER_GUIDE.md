# Docker Guide (Hinglish)

Docker ka simple samajh — code nahi, sirf concept.

---

## Docker kya hai?

Docker **containers** banata hai — jaise chhote, alag-alag boxes jinke andar tumhara app + uski zaroori cheezen (runtime, libraries, config) sab ek saath pack hoti hain. Ye box kisi bhi machine pe chal sakta hai jahan Docker installed ho.

---

## Container vs VM (Virtual Machine)

- **VM:** Har VM ke andar pura OS (Windows/Linux) hota hai → zyada RAM, disk, slow start.
- **Container:** OS share hota hai, sirf app + uski dependencies alag hote hain → kam resource, tez start, zyada containers ek hi machine pe.

**Short:** VM = pura ghar, Container = ek room jisme tumhara app rehta hai.

---

## Main concepts

| Term | Matlab |
|------|--------|
| **Image** | Read-only blueprint/template — app ka code + runtime + dependencies. Isi se container banate ho. |
| **Container** | Image ka running instance. `docker run image-name` se naya container start hota hai. |
| **Dockerfile** | Text file jisme likhte ho: kaunsi base image use karni hai, kya copy karna hai, kaunse commands chalane hain. Isse naya image build hota hai. |
| **Docker Compose** | Jab multiple services chahiye (e.g. app + database + Redis), ek `docker-compose.yml` mein sab define karke ek saath run kar sakte ho. |

---

## Kyu use karte hain?

- **"Mere machine pe chal raha tha"** wala problem kam hota hai — same image dev, staging, production sab jagah chal sakta hai.
- Setup repeatable hota hai — naya dev `docker compose up` se kaam shuru kar sakta hai.
- Deploy simple hota hai — AWS, GCP, Azure, koi bhi platform Docker support karta hai.

---

## Flow short mein

1. **Dockerfile** likho → `docker build` → **image** banti hai.
2. **Image** se `docker run` → **container** start hota hai.
3. Zarurat ho to **Docker Compose** se multiple containers ek saath run karo.

---

## Next step

Agar isi project (`stripe-integrate`) ko Docker mein chalana hai, to ye files ready hain:
- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `.env.example` (copy karke `.env` banao)

### Run (docker compose)
1. Project root me `.env` banao (values `.env.example` se) aur Stripe/Firebase env values set karo (secrets commit mat karna).
2. Development (with hot reload):
```bash
docker compose --profile dev up --build
```

Production:
```bash
docker compose --profile prod up --build
```

App `http://localhost:5000` par open hoga.

### Build only (manual)
```bash
docker build -t stripe-integrate .
docker run --rm -p 5000:5000 stripe-integrate
```
