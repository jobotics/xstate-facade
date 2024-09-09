import axios, { AxiosResponse } from "axios";

axios.defaults.timeout = 5000;

export class HttpService {
  get<T>(url: string): Promise<T> {
    return axios
      .get(url)
      .then((resp: AxiosResponse<T>) => resp.data)
      .catch((resp) => resp.error);
  }

  post<T>(url: string, data: any): Promise<T> {
    return axios
      .post(url, data)
      .then((resp: AxiosResponse<T>) => resp.data)
      .catch((error) => Promise.reject(error));
  }
}
