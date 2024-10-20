# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY ./web /app/web

# Install any dependencies specified in requirements.txt
RUN pip install --no-cache-dir -r web/requirements.txt

# Set the environment variable to production
ENV FLASK_DEBUG=production

# Expose the port that the Flask app will run on
EXPOSE 5000

# Command to run Gunicorn as the WSGI server for production
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "web.app:app"]
