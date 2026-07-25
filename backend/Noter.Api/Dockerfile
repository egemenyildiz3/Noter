# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Noter.Api.csproj ./
RUN dotnet restore
COPY . ./
RUN dotnet publish -c Release -o /app

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./

# DB and uploaded images both live on the same mounted volume.
ENV DB_PATH=/data/noter.db
ENV UPLOADS_PATH=/data/uploads
ENV ASPNETCORE_URLS=http://+:8080
RUN mkdir -p /data
VOLUME /data

EXPOSE 8080
ENTRYPOINT ["dotnet", "Noter.Api.dll"]
